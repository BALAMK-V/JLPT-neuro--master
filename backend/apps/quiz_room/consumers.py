"""Multiplayer quiz room WebSocket consumer — v3 with chat, voice, file sharing."""
from __future__ import annotations

import asyncio
import base64
import json
import os
import random
import time
from typing import Any

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

_ROOMS: dict[str, dict] = {}

QUESTION_DURATION = 15
MAX_PLAYERS = 4
MIN_PLAYERS = 1

DEFAULT_AVATAR = {
    "skin_tone": "#f5d0b0",
    "hair_style": "short",
    "hair_color": "#2c2c2c",
    "eye_shape": "round",
    "eye_color": "#4a7c59",
    "accessory": "none",
}


def _room_key(code: str) -> str:
    return f"quiz.room.{code}"


async def _broadcast(consumer: AsyncWebsocketConsumer, code: str, payload: dict) -> None:
    await consumer.channel_layer.group_send(
        _room_key(code),
        {"type": "quiz.message", "payload": payload},
    )


async def _send_to(consumer: AsyncWebsocketConsumer, payload: dict) -> None:
    await consumer.send(json.dumps(payload))


@database_sync_to_async
def _fetch_questions(level: str, count: int = 10) -> list[dict]:
    from apps.jlpt_exam.models import ExamQuestion
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


@database_sync_to_async
def _save_uploaded_file(file_data_b64: str, filename: str, user_id: int | None) -> str:
    import uuid
    from django.core.files.storage import default_storage

    clean_name = f"{uuid.uuid4().hex}_{os.path.basename(filename)}"
    path = f"quiz_shares/{clean_name}"
    try:
        decoded = base64.b64decode(file_data_b64)
    except Exception:
        decoded = file_data_b64.encode()
    saved_path = default_storage.save(path, type("buf", (), {"read": lambda s: decoded, "size": len(decoded)})())
    return default_storage.url(saved_path)


@database_sync_to_async
def _get_player_info(user) -> dict:  # type: ignore[no-untyped-def]
    from apps.users.level import compute_player_level
    from django.contrib.auth.models import AnonymousUser

    if isinstance(user, AnonymousUser) or not user.is_authenticated:
        return {
            "user_id": None,
            "name": f"Guest-{random.randint(1000, 9999)}",
            "avatar": DEFAULT_AVATAR.copy(),
            "level": 1,
            "level_title": "Genin",
        }

    try:
        profile = user.profile
        display = profile.display_name or profile.nickname or user.username
        avatar = profile.avatar_config or DEFAULT_AVATAR.copy()
    except Exception:
        display = user.username
        avatar = DEFAULT_AVATAR.copy()

    level_info = compute_player_level(user)
    return {
        "user_id": user.id,
        "name": display,
        "avatar": avatar,
        "level": level_info["level"],
        "level_title": level_info["title"],
    }


@database_sync_to_async
def _save_game_result(room: dict) -> None:
    from django.contrib.auth import get_user_model
    from django.utils import timezone
    from apps.quiz_room.models import QuizGame, QuizPlayerStat

    User = get_user_model()

    players_data = []
    for ch, p in room["players"].items():
        players_data.append({
            "user_id": p.get("user_id"),
            "name": p["name"],
            "avatar_config": p.get("avatar", {}),
            "level": p.get("level", 1),
            "score": p["score"],
        })

    game = QuizGame.objects.create(
        code=room["code"],
        level=room["level"],
        players=players_data,
        questions=room["questions"],
        rounds=room.get("rounds_log", []),
        winner_id=room.get("winner_id"),
        ended_at=timezone.now(),
    )

    sorted_players = sorted(room["players"].values(), key=lambda p: p["score"], reverse=True)
    for rank, p in enumerate(sorted_players, 1):
        uid = p.get("user_id")
        if not uid:
            continue
        try:
            user = User.objects.get(id=uid)
        except User.DoesNotExist:
            continue

        answers = [
            a for rnd_data in room.get("rounds_log", [])
            for a in rnd_data.get("answers", [])
            if a.get("user_id") == uid
        ]
        correct = sum(1 for a in answers if a.get("correct"))
        total = len(answers)
        times = [a["response_time_ms"] for a in answers if a.get("response_time_ms") is not None]
        avg_time = sum(times) / len(times) if times else 0.0

        QuizPlayerStat.objects.update_or_create(
            user=user,
            game=game,
            defaults={
                "score": p["score"],
                "correct_count": correct,
                "total_count": total,
                "avg_response_time_ms": avg_time,
                "rank": rank,
            },
        )


class QuizConsumer(AsyncWebsocketConsumer):

    async def connect(self) -> None:
        self.room_code: str = self.scope["url_route"]["kwargs"]["code"]
        self.group_name = _room_key(self.room_code)
        self.answer_task: asyncio.Task | None = None

        player_info = await _get_player_info(self.scope.get("user"))
        self.user_id = player_info["user_id"]
        self.player_name = player_info["name"]

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        if self.room_code not in _ROOMS:
            _ROOMS[self.room_code] = {
                "code": self.room_code,
                "players": {},
                "state": "lobby",
                "questions": [],
                "q_index": 0,
                "level": "N3",
                "answers": {},
                "rounds_log": [],
                "winner_id": None,
                "chat_history": [],
                "shared_files": [],
            }
        room = _ROOMS[self.room_code]
        room["players"][self.channel_name] = {
            **player_info,
            "score": 0,
            "answered": False,
            "streak": 0,
            "response_time_ms": None,
            "q_start_time": None,
        }

        await _broadcast(self, self.room_code, {
            "type": "players_update",
            "players": self._player_list(room),
            "state": room["state"],
        })

        # Send existing chat history and shared files to the joining player
        if room.get("chat_history"):
            await _send_to(self, {"type": "chat_history", "messages": room["chat_history"]})
        if room.get("shared_files"):
            await _send_to(self, {"type": "file_history", "files": room["shared_files"]})

    async def disconnect(self, code: int) -> None:
        if self.room_code in _ROOMS:
            room = _ROOMS[self.room_code]
            room["players"].pop(self.channel_name, None)
            if not room["players"]:
                del _ROOMS[self.room_code]
            else:
                await _broadcast(self, self.room_code, {
                    "type": "players_update",
                    "players": self._player_list(room),
                    "state": room["state"],
                })
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
                await self.send(json.dumps({
                    "type": "error",
                    "message": f"No questions found for level {level}. Import some exams first.",
                }))
                return
            room["questions"] = questions
            room["q_index"] = 0
            room["state"] = "playing"
            room["rounds_log"] = []
            for p in room["players"].values():
                p["score"] = 0
                p["answered"] = False
                p["streak"] = 0
                p["response_time_ms"] = None
            await self._send_question(room)

        elif action == "chat_message":
            text = (msg.get("text") or "").strip()
            if text:
                chat_msg = {
                    "user_id": self.user_id,
                    "name": self.player_name,
                    "text": text,
                    "ts": time.time(),
                }
                room.setdefault("chat_history", []).append(chat_msg)
                if len(room["chat_history"]) > 100:
                    room["chat_history"] = room["chat_history"][-100:]
                await _broadcast(self, self.room_code, {
                    "type": "chat_message",
                    "message": chat_msg,
                })

        elif action == "voice_offer":
            target = msg.get("target")
            await _broadcast(self, self.room_code, {
                "type": "voice_offer",
                "from": self.user_id,
                "from_name": self.player_name,
                "sdp": msg.get("sdp"),
                "target": target,
            })

        elif action == "voice_answer":
            await _broadcast(self, self.room_code, {
                "type": "voice_answer",
                "from": self.user_id,
                "from_name": self.player_name,
                "sdp": msg.get("sdp"),
            })

        elif action == "voice_ice":
            await _broadcast(self, self.room_code, {
                "type": "voice_ice",
                "from": self.user_id,
                "from_name": self.player_name,
                "candidate": msg.get("candidate"),
            })

        elif action == "voice_mute":
            await _broadcast(self, self.room_code, {
                "type": "voice_mute",
                "user_id": self.user_id,
                "name": self.player_name,
                "muted": msg.get("muted", True),
            })

        elif action == "share_file":
            file_data = msg.get("file_data", "")
            filename = msg.get("filename", "file")
            file_url = await _save_uploaded_file(file_data, filename, self.user_id)
            share_msg = {
                "user_id": self.user_id,
                "name": self.player_name,
                "filename": filename,
                "file_url": file_url,
                "file_type": msg.get("file_type", "unknown"),
                "ts": time.time(),
            }
            room.setdefault("shared_files", []).append(share_msg)
            await _broadcast(self, self.room_code, {
                "type": "file_shared",
                "file": share_msg,
            })

        elif action == "answer":
            if room["state"] != "playing":
                return
            player = room["players"].get(self.channel_name)
            if not player or player.get("answered"):
                return
            player["answered"] = True

            now_ms = int(time.time() * 1000)
            q_start = player.get("q_start_time") or now_ms
            response_time_ms = now_ms - q_start
            player["response_time_ms"] = response_time_ms

            q_idx = room["q_index"]
            if q_idx >= len(room["questions"]):
                return
            question = room["questions"][q_idx]
            selected_id = msg.get("option_id")
            correct = selected_id == question["correct_id"]

            if correct:
                player["score"] += 10
                player["streak"] = player.get("streak", 0) + 1
            else:
                player["streak"] = 0

            room["answers"][self.channel_name] = {
                "user_id": player.get("user_id"),
                "name": player["name"],
                "option_id": selected_id,
                "correct": correct,
                "response_time_ms": response_time_ms,
            }

            await _broadcast(self, self.room_code, {
                "type": "answer_received",
                "player": {
                    "user_id": player.get("user_id"),
                    "name": player["name"],
                    "streak": player["streak"],
                    "response_time_ms": response_time_ms,
                },
                "answered_count": sum(1 for p in room["players"].values() if p["answered"]),
                "total_players": len(room["players"]),
            })

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
        now_ms = int(time.time() * 1000)
        for p in room["players"].values():
            p["answered"] = False
            p["response_time_ms"] = None
            p["q_start_time"] = now_ms

        await _broadcast(self, self.room_code, {
            "type": "question",
            "index": q_idx,
            "total": len(room["questions"]),
            "text": question["text"],
            "passage": question["passage"],
            "options": question["options"],
            "duration": QUESTION_DURATION,
        })

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

        round_data = {
            "round_index": q_idx,
            "question_id": question["id"],
            "answers": list(room["answers"].values()),
            "scores": [{"user_id": p.get("user_id"), "name": p["name"], "score": p["score"]}
                       for p in room["players"].values()],
        }
        room["rounds_log"].append(round_data)

        await _broadcast(self, self.room_code, {
            "type": "reveal",
            "correct_id": question["correct_id"],
            "explanation": question["explanation"],
            "scores": self._player_list(room),
            "answers": list(room["answers"].values()),
            "round_index": q_idx,
        })

        await asyncio.sleep(3)
        room["q_index"] += 1
        if room["q_index"] >= len(room["questions"]):
            await self._finish_game(room)
        else:
            await self._send_question(room)

    async def _finish_game(self, room: dict) -> None:
        room["state"] = "finished"
        sorted_players = sorted(room["players"].values(), key=lambda p: p["score"], reverse=True)
        if sorted_players:
            room["winner_id"] = sorted_players[0].get("user_id")

        scores = self._player_list(room)
        scores_sorted = sorted(scores, key=lambda p: p["score"], reverse=True)

        await _broadcast(self, self.room_code, {
            "type": "game_over",
            "scores": scores_sorted,
            "winner": scores_sorted[0]["name"] if scores_sorted else None,
            "winner_id": room["winner_id"],
        })

        try:
            await _save_game_result(room)
        except Exception:
            pass

    async def quiz_message(self, event: dict) -> None:
        await self.send(json.dumps(event["payload"]))

    def _player_list(self, room: dict) -> list[dict]:
        return [
            {
                "user_id": p.get("user_id"),
                "name": p["name"],
                "avatar": p.get("avatar", DEFAULT_AVATAR),
                "level": p.get("level", 1),
                "level_title": p.get("level_title", "Genin"),
                "score": p["score"],
                "answered": p.get("answered", False),
                "streak": p.get("streak", 0),
                "response_time_ms": p.get("response_time_ms"),
            }
            for p in room["players"].values()
        ]
