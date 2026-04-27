from __future__ import annotations

from django import forms
from django.contrib import admin, messages
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.db.models import Avg, Count
from django.shortcuts import redirect, render
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html

from apps.flashcards.models import Card, Deck
from apps.neuro.models import UserNeuroAnswer, UserNeuroProfile
from apps.notes.models import Note
from apps.tracking.models import Session, UserProgress

from .models import StudyCompanion, UserAppearanceSettings, UserProfile


User = get_user_model()


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    extra = 0
    fieldsets = (
        (
            "Learning setup",
            {
                "fields": (
                    "learning_type",
                    "jlpt_level",
                    "daily_goal_new_items",
                    "session_minutes_preference",
                )
            },
        ),
        ("Reminders", {"fields": ("reminders_enabled", "reminder_interval_minutes")}),
        ("UI preferences", {"classes": ("collapse",), "fields": ("ui_prefs",)}),
    )


class UserNeuroProfileInline(admin.StackedInline):
    model = UserNeuroProfile
    can_delete = False
    extra = 0
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Analysis result", {"fields": ("result_type", "trait_scores", "summary")}),
        ("Timestamps", {"classes": ("collapse",), "fields": ("created_at", "updated_at")}),
    )


class UserProgressInline(admin.TabularInline):
    model = UserProgress
    extra = 0
    fields = ("item_type", "item_id", "accuracy", "attempts", "correct_attempts", "next_review_date", "last_result_correct")
    readonly_fields = ("accuracy", "attempts", "correct_attempts", "last_result_correct")
    show_change_link = True


class UserAppearanceSettingsInline(admin.StackedInline):
    model = UserAppearanceSettings
    can_delete = False
    extra = 0
    fieldsets = (
        ("Theme and type", {"fields": ("theme_mode", "font_family", "font_size", "font_weight", "font_color")}),
        ("Background", {"fields": ("background_type", "background_value", "blur_level", "opacity")}),
        ("Interface", {"fields": ("border_radius", "shadow_level", "animation_level", "layout_density")}),
    )


class StudyCompanionInline(admin.StackedInline):
    model = StudyCompanion
    can_delete = False
    extra = 0
    fields = ("enabled", "character_type", "position", "sound_enabled")


class SessionInline(admin.TabularInline):
    model = Session
    extra = 0
    fields = ("goal_type", "goal_target", "progress_count", "started_at", "ended_at", "duration_seconds")
    readonly_fields = ("started_at",)
    show_change_link = True


class DeckInline(admin.TabularInline):
    model = Deck
    extra = 0
    fields = ("name", "deck_type", "jlpt_level", "is_locked", "updated_at")
    readonly_fields = ("updated_at",)
    show_change_link = True


class NoteInline(admin.TabularInline):
    model = Note
    extra = 0
    fields = ("note_type", "reference_type", "reference_id", "content", "updated_at")
    readonly_fields = ("updated_at",)
    show_change_link = True


class GodModeForm(forms.Form):
    users = forms.ModelMultipleChoiceField(
        queryset=User.objects.order_by("username"),
        widget=admin.widgets.FilteredSelectMultiple("users", is_stacked=False),
        help_text="Pick one or more learners to modify.",
    )
    jlpt_level = forms.ChoiceField(choices=[("", "Keep current")] + list(UserProfile.JLPTLevel.choices), required=False)
    learning_type = forms.ChoiceField(choices=[("", "Keep current")] + list(UserProfile.LearningType.choices), required=False)
    session_minutes_preference = forms.IntegerField(min_value=1, max_value=180, required=False)
    reminder_interval_minutes = forms.IntegerField(min_value=1, max_value=240, required=False)
    daily_goal_new_items = forms.IntegerField(min_value=0, max_value=1000, required=False)
    reminders_enabled = forms.NullBooleanField(required=False, label="Reminders enabled")

    create_session = forms.BooleanField(required=False)
    session_goal_type = forms.ChoiceField(choices=Session.GoalType.choices, required=False)
    session_goal_target = forms.IntegerField(min_value=1, max_value=1000, required=False)

    create_deck = forms.BooleanField(required=False)
    deck_name = forms.CharField(max_length=120, required=False)
    deck_type = forms.ChoiceField(choices=Deck.DeckType.choices, required=False)
    deck_level = forms.ChoiceField(choices=UserProfile.JLPTLevel.choices, required=False)
    deck_locked = forms.BooleanField(required=False)

    note_content = forms.CharField(widget=forms.Textarea(attrs={"rows": 4}), required=False)
    reset_progress = forms.BooleanField(required=False, help_text="Deletes UserProgress rows for selected users.")
    make_cards_due_now = forms.BooleanField(required=False, help_text="Moves all selected users' flashcards into the due queue.")

    def clean(self):  # type: ignore[no-untyped-def]
        cleaned = super().clean()
        if cleaned.get("create_session") and not cleaned.get("session_goal_target"):
            self.add_error("session_goal_target", "Set a target when creating sessions.")
        if cleaned.get("create_deck") and not cleaned.get("deck_name"):
            self.add_error("deck_name", "Set a deck name when creating decks.")
        return cleaned


@admin.action(description="Create a 10-item mixed session for selected users")
def create_mixed_session(modeladmin, request, queryset):  # type: ignore[no-untyped-def]
    sessions = [Session(user=user, goal_type=Session.GoalType.MIXED, goal_target=10) for user in queryset]
    Session.objects.bulk_create(sessions)
    messages.success(request, f"Created {len(sessions)} mixed sessions.")


@admin.action(description="Move selected users' cards to due now")
def make_selected_cards_due_now(modeladmin, request, queryset):  # type: ignore[no-untyped-def]
    count = Card.objects.filter(deck__user__in=queryset).update(due_at=timezone.now(), suspended=False)
    messages.success(request, f"Moved {count} cards into the due queue.")


@admin.action(description="Reset selected users' progress rows")
def reset_selected_progress(modeladmin, request, queryset):  # type: ignore[no-untyped-def]
    count, _ = UserProgress.objects.filter(user__in=queryset).delete()
    messages.warning(request, f"Deleted {count} progress rows.")


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "learning_type",
        "jlpt_level",
        "daily_goal_new_items",
        "session_minutes_preference",
        "reminders_enabled",
        "updated_at",
    )
    list_filter = ("learning_type", "jlpt_level", "reminders_enabled")
    search_fields = ("user__username", "user__email")
    list_select_related = ("user",)
    fieldsets = (
        ("Learner", {"fields": ("user", "learning_type", "jlpt_level")}),
        ("Goals", {"fields": ("daily_goal_new_items", "session_minutes_preference")}),
        ("Reminders", {"fields": ("reminders_enabled", "reminder_interval_minutes")}),
        ("UI preferences", {"fields": ("ui_prefs",)}),
    )


class UserAdmin(DjangoUserAdmin):
    change_list_template = "admin/auth/user/change_list.html"
    inlines = [
        UserProfileInline,
        UserAppearanceSettingsInline,
        StudyCompanionInline,
        UserNeuroProfileInline,
        UserProgressInline,
        SessionInline,
        DeckInline,
        NoteInline,
    ]
    actions = [create_mixed_session, make_selected_cards_due_now, reset_selected_progress]
    list_display = (
        "username",
        "email",
        "profile_level",
        "profile_learning_type",
        "avg_accuracy",
        "due_reviews",
        "deck_count",
        "is_staff",
        "last_login",
    )
    list_filter = ("is_staff", "is_superuser", "is_active", "groups", "profile__learning_type", "profile__jlpt_level")
    search_fields = ("username", "email", "first_name", "last_name", "profile__learning_type", "profile__jlpt_level")

    def get_queryset(self, request):  # type: ignore[no-untyped-def]
        qs = super().get_queryset(request).select_related("profile")
        return qs.annotate(
            admin_avg_accuracy=Avg("progress_items__accuracy"),
            admin_deck_count=Count("flash_decks", distinct=True),
            admin_due_count=Count("progress_items", distinct=True),
        )

    def get_urls(self):  # type: ignore[no-untyped-def]
        urls = super().get_urls()
        custom = [path("god-mode/", self.admin_site.admin_view(self.god_mode_view), name="users_user_god_mode")]
        return custom + urls

    def profile_level(self, obj):  # type: ignore[no-untyped-def]
        return getattr(getattr(obj, "profile", None), "jlpt_level", "-")

    profile_level.short_description = "JLPT"
    profile_level.admin_order_field = "profile__jlpt_level"

    def profile_learning_type(self, obj):  # type: ignore[no-untyped-def]
        return getattr(getattr(obj, "profile", None), "learning_type", "-")

    profile_learning_type.short_description = "Learning"
    profile_learning_type.admin_order_field = "profile__learning_type"

    def avg_accuracy(self, obj):  # type: ignore[no-untyped-def]
        value = getattr(obj, "admin_avg_accuracy", None)
        return "-" if value is None else f"{round(value)}%"

    avg_accuracy.short_description = "Accuracy"

    def due_reviews(self, obj):  # type: ignore[no-untyped-def]
        # Annotated count is intentionally broad; the full due-date filtered view is in Progress admin.
        return getattr(obj, "admin_due_count", 0)

    due_reviews.short_description = "Progress rows"

    def deck_count(self, obj):  # type: ignore[no-untyped-def]
        return getattr(obj, "admin_deck_count", 0)

    deck_count.short_description = "Decks"

    def changelist_view(self, request, extra_context=None):  # type: ignore[no-untyped-def]
        extra_context = extra_context or {}
        extra_context["god_mode_url"] = reverse("admin:users_user_god_mode")
        return super().changelist_view(request, extra_context=extra_context)

    def god_mode_view(self, request):  # type: ignore[no-untyped-def]
        if request.method == "POST":
            form = GodModeForm(request.POST)
            if form.is_valid():
                users = list(form.cleaned_data["users"])
                self._apply_god_mode(request, form.cleaned_data, users)
                return redirect("..")
        else:
            initial = {}
            selected = request.GET.get("ids")
            if selected:
                initial["users"] = [int(pk) for pk in selected.split(",") if pk.isdigit()]
            form = GodModeForm(initial=initial)

        context = {
            **self.admin_site.each_context(request),
            "title": "God Mode: learner operations",
            "form": form,
            "opts": self.model._meta,
            "summary": self._admin_summary(),
        }
        return render(request, "admin/god_mode.html", context)

    def _apply_god_mode(self, request, data, users):  # type: ignore[no-untyped-def]
        profile_updates = {}
        for key in [
            "jlpt_level",
            "learning_type",
            "session_minutes_preference",
            "reminder_interval_minutes",
            "daily_goal_new_items",
        ]:
            if data.get(key) not in ("", None):
                profile_updates[key] = data[key]
        if data.get("reminders_enabled") is not None:
            profile_updates["reminders_enabled"] = data["reminders_enabled"]

        for user in users:
            profile, _ = UserProfile.objects.get_or_create(user=user)
            for key, value in profile_updates.items():
                setattr(profile, key, value)
            if data.get("learning_type"):
                profile.ui_prefs = {**(profile.ui_prefs or {}), "learning_alias": data["learning_type"]}
            profile.save()

            if data.get("create_session"):
                Session.objects.create(
                    user=user,
                    goal_type=data.get("session_goal_type") or Session.GoalType.MIXED,
                    goal_target=data.get("session_goal_target") or 10,
                )

            if data.get("create_deck"):
                Deck.objects.get_or_create(
                    user=user,
                    name=data["deck_name"],
                    defaults={
                        "deck_type": data.get("deck_type") or Deck.DeckType.CUSTOM,
                        "jlpt_level": data.get("deck_level") or profile.jlpt_level,
                        "is_locked": data.get("deck_locked") or False,
                    },
                )

            if data.get("note_content"):
                Note.objects.create(user=user, note_type=Note.NoteType.CONTEXT, content=data["note_content"])

        if data.get("reset_progress"):
            UserProgress.objects.filter(user__in=users).delete()
        if data.get("make_cards_due_now"):
            Card.objects.filter(deck__user__in=users).update(due_at=timezone.now(), suspended=False)

        messages.success(request, f"Applied god mode changes to {len(users)} user(s).")

    def _admin_summary(self):  # type: ignore[no-untyped-def]
        return {
            "users": User.objects.count(),
            "profiles": UserProfile.objects.count(),
            "progress": UserProgress.objects.count(),
            "sessions": Session.objects.count(),
            "decks": Deck.objects.count(),
            "notes": Note.objects.count(),
            "neuro_profiles": UserNeuroProfile.objects.count(),
            "answers": UserNeuroAnswer.objects.count(),
        }

    def god_mode_link(self, obj):  # type: ignore[no-untyped-def]
        url = reverse("admin:users_user_god_mode")
        return format_html('<a class="button" href="{}?ids={}">God mode</a>', url, obj.pk)


try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass

admin.site.register(User, UserAdmin)
