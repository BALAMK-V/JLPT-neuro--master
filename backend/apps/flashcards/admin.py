from django.contrib import admin
from django.utils import timezone

from .models import Card, Deck


@admin.action(description="Suspend selected cards")
def suspend_cards(modeladmin, request, queryset):  # type: ignore[no-untyped-def]
    queryset.update(suspended=True)


@admin.action(description="Unsuspend and make selected cards due now")
def unsuspend_due_now(modeladmin, request, queryset):  # type: ignore[no-untyped-def]
    queryset.update(suspended=False, due_at=timezone.now())


class CardInline(admin.TabularInline):
    model = Card
    extra = 0
    fields = ("front", "back", "suspended", "due_at", "last_rating", "repetitions", "interval_days")
    readonly_fields = ("last_rating", "repetitions", "interval_days")
    show_change_link = True


@admin.register(Deck)
class DeckAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "name", "deck_type", "jlpt_level", "is_locked", "card_count", "updated_at")
    list_filter = ("deck_type", "jlpt_level", "is_locked")
    search_fields = ("name", "user__username", "user__email")
    list_select_related = ("user",)
    list_editable = ("deck_type", "jlpt_level", "is_locked")
    inlines = [CardInline]

    def card_count(self, obj):  # type: ignore[no-untyped-def]
        return obj.cards.count()

    card_count.short_description = "Cards"


@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
    list_display = ("id", "deck", "deck_user", "suspended", "due_at", "last_rating", "repetitions", "interval_days")
    list_filter = ("suspended", "last_rating", "deck__deck_type", "deck__jlpt_level")
    search_fields = ("front", "back", "deck__name", "deck__user__username", "deck__user__email")
    list_select_related = ("deck", "deck__user")
    list_editable = ("suspended", "due_at")
    actions = [suspend_cards, unsuspend_due_now]
    fieldsets = (
        ("Owner", {"fields": ("deck", "kanji", "vocab")}),
        ("Card", {"fields": ("front", "back", "tags", "suspended")}),
        ("Scheduling", {"fields": ("due_at", "last_reviewed", "last_rating", "repetitions", "interval_days", "ease_factor", "lapses")}),
    )

    def deck_user(self, obj):  # type: ignore[no-untyped-def]
        return obj.deck.user

    deck_user.short_description = "User"
