from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import StudyCompanion, UserAppearanceSettings, UserProfile

from .serializers import MeSerializer, StudyCompanionSerializer, UserAppearanceSettingsSerializer


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):  # type: ignore[no-untyped-def]
        UserProfile.objects.get_or_create(user=request.user)
        return Response(MeSerializer(request.user).data)

    def patch(self, request):  # type: ignore[no-untyped-def]
        UserProfile.objects.get_or_create(user=request.user)
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def default_background_value():
    return {"from": "#0b1020", "to": "#11263f", "angle": 180}


class AppearanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, user):  # type: ignore[no-untyped-def]
        obj, created = UserAppearanceSettings.objects.get_or_create(user=user)
        if created and not obj.background_value:
            obj.background_value = default_background_value()
            obj.save(update_fields=["background_value"])
        return obj

    def get(self, request):  # type: ignore[no-untyped-def]
        return Response(UserAppearanceSettingsSerializer(self.get_object(request.user)).data)


class AppearanceUpdateView(AppearanceView):
    def post(self, request):  # type: ignore[no-untyped-def]
        obj = self.get_object(request.user)
        serializer = UserAppearanceSettingsSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AppearanceResetView(AppearanceView):
    def post(self, request):  # type: ignore[no-untyped-def]
        UserAppearanceSettings.objects.filter(user=request.user).delete()
        obj = UserAppearanceSettings.objects.create(user=request.user, background_value=default_background_value())
        return Response(UserAppearanceSettingsSerializer(obj).data)


class CompanionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, user):  # type: ignore[no-untyped-def]
        obj, created = StudyCompanion.objects.get_or_create(user=user)
        if created and not obj.position:
            obj.position = {"x": 24, "y": 24, "corner": "bottom-right"}
            obj.save(update_fields=["position"])
        return obj

    def get(self, request):  # type: ignore[no-untyped-def]
        return Response(StudyCompanionSerializer(self.get_object(request.user)).data)


class CompanionUpdateView(CompanionView):
    def post(self, request):  # type: ignore[no-untyped-def]
        obj = self.get_object(request.user)
        serializer = StudyCompanionSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
