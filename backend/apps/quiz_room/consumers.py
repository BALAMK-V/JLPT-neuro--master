"""Multiplayer quiz room WebSocket consumer."""
from __future__ import annotations

import asyncio
import json
import random
from typing import Any

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

# In-memory room state (works with InMemoryChannelLayer; Redis keeps it alive across workers)
_ROOMS: dict[str, dict] = {}

QUESTION_DURATION = 15  # seconds per question
MAX_PLAYERS = 4
MIN_PLAYERS = 1


def _room_key(code: str) -> str:
    return f"quiz:room:{code}"


async def _broadcast(consumer: AsyncWebsocketConsumer, code: str, payload: dict) -> None:
    await consumer.channel_layer.group_send(
        _room_key(code),
        {"type": "quiz.message", "payload": payload},
    )


@database_sync_to_async
def _fetch_questions(level: str, count: int = 10) -> list[dict]:
    from apps.jlpt_exam.models import ExamQuestion, ExamOption
    import random as rnd

    qs = list(
        ExamQuestion.objects.filter(
            exam__level=level,
            exam__is_published=True,
            question_type="multiple_choice",
        )
        .prefetch_related("options")
        .order_by("?")[:count]
    )
    result = []
    for q in qs:
        opts = list(q.options.all())
        rnd.shuffle(opts)
        result.append(
            {
                "id": q.id,
                "text": q.question_text,
                "passage": q.passage_text,
                "options": [{"id": o.id, "label": o.label, "text": o.text} for o in opts],
                "correct_id": next((o.id for o in opts if o.is_correct), None),
                "explanation": q.explanation,
            }
        )
    return result


class QuizConsumer(AsyncWebsocketConsumer):

    async def connect(self) -> None:
        self.room_code: str = self.scope["url_route"]["kwargs"]["code"]
        self.group_name = _room_key(self.room_code)
        self.username: str = (
            self.scope.get("user") and self.scope["user"].username
        ) or f"Guest-{random.randint(1000, 9999)}"
        self.answer_task: asyncio.Task | None = None

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Add player to room
        if self.room_code not in _ROOMS:
            _ROOMS[self.room_code] = {
                "players": {},
                "state": "lobby",  # lobby | playing | finished
                "questions": [],
                "q_index": 0,
                "level": "N3",
                "answers": {},
            }
        room = _ROOMS[self.room_code]
        room["players"][self.channel_name] = {
            "name": self.username,
            "score": 0,
            "answered": False,
        }

        await _broadcast(
            self,
            self.room_code,
            {
                "type": "players_update",
                "players": self._player_list(room),
                "state": room["state"],
            },
        )

    async def disconnect(self, code: int) -> None:
        if self.room_code in _ROOMS:
            room = _ROOMS[self.room_code]
            room["players"].pop(self.channel_name, None)
            if not room["players"]:
                del _ROOMS[self.room_code]
            else:
                await _broadcast(
                    self,
                    self.room_code,
                    {
                        "type": "players_update",
                        "players": self._player_list(room),
                        "state": room["state"],
                    },
                )
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data: str = "", **_: Any) -> None:
        try:
            msg = json.loads(text_data)
        except json.JSONDecodeError:
            return

        action = msg.get("action")
        room = _ROOMS.get(self.room_code)
        if not room:
            return

        if action == "set_level":
            room["level"] = msg.get("level", "N3")
            await _broadcast(self, self.room_code, {"type": "level_set", "level": room["level"]})

        elif action == "start_game":
            if room["state"] != "lobby":
                return
            level = room.get("level", "N3")
            questions = await _fetch_questions(level, count=10)
            if not questions:
                await self.send(json.dumps({"type": "error", "message": f"No questions found for level {level}. Import some exams first."}))
                return
            room["questions"] = questions
            room["q_index"] = 0
            room["state"] = "playing"
            for p in room["players"].values():
                p["score"] = 0
                p["answered"] = False
            await self._send_question(room)

        elif action == "answer":
            if room["state"] != "playing":
                return
            player = room["players"].get(self.channel_name)
            if not player or player.get("answered"):
                return
            player["answered"] = True

            q_idx = room["q_index"]
            if q_idx >= len(room["questions"]):
                return
            question = room["questions"][q_idx]
            selected_id = msg.get("option_id")
            correct = selected_id == question["correct_id"]
            if correct:
                player["score"] += 10

            room["answers"][self.channel_name] = {
                "name": player["name"],
                "option_id": selected_id,
                "correct": correct,
            }

            await _broadcast(self, self.room_code, {
                "type": "answer_received",
                "player": player["name"],
                "answered_count": sum(1 for p in room["players"].values() if p["answered"]),
                "total_players": len(room["players"]),
            })

            # If all players answered, advance immediately
            if all(p["answered"] for p in room["players"].values()):
                if self.answer_task:
                    self.answer_task.cancel()
                await self._reveal_and_advance(room)

    async def _send_question(self, room: dict) -> None:
        q_idx = room["q_index"]
        if q_idx >= len(room["questions"]):
            await self._finish_game(room)
            return

        question = room["questions"][q_idx]
        room["answers"] = {}
        for p in room["players"].values():
            p["answered"] = False

        await _broadcast(self, self.room_code, {
            "type": "question",
            "index": q_idx,
            "total": len(room["questions"]),
            "text": question["text"],
            "passage": question["passage"],
            "options": question["options"],
            "duration": QUESTION_DURATION,
        })

        # Auto-advance after timeout
        self.answer_task = asyncio.create_task(self._question_timeout(room, QUESTION_DURATION))

    async def _question_timeout(self, room: dict, delay: int) -> None:
        await asyncio.sleep(delay)
        if room.get("state") == "playing":
            await self._reveal_and_advance(room)

    async def _reveal_and_advance(self, room: dict) -> None:
        q_idx = room["q_index"]
        if q_idx >= len(room["questions"]):
            return
        question = room["questions"][q_idx]

        await _broadcast(self, self.room_code, {
            "type": "reveal",
            "correct_id": question["correct_id"],
            "explanation": question["explanation"],
            "scores": self._player_list(room),
            "answers": list(room["answers"].values()),
        })

        await asyncio.sleep(3)
        room["q_index"] += 1
        if room["q_index"] >= len(room["questions"]):
            await self._finish_game(room)
        else:
            await self._send_question(room)

    async def _finish_game(self, room: dict) -> None:
        room["state"] = "finished"
        scores = sorted(self._player_list(room), key=lambda p: p["score"], reverse=True)
        await _broadcast(self, self.room_code, {
            "type": "game_over",
            "scores": scores,
            "winner": scores[0]["name"] if scores else None,
        })

    # ── Channel layer message handler ──────────────────────────────────────────

    async def quiz_message(self, event: dict) -> None:
        await self.send(json.dumps(event["payload"]))

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _player_list(self, room: dict) -> list[dict]:
        return [
            {"name": p["name"], "score": p["score"]}
            for p in room["players"].values()
        ]
