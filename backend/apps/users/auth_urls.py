from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    ChangePasswordView,
    ForgotPasswordView,
    RegisterView,
    ResetPasswordView,
    UserManagementDetailView,
    UserManagementListView,
)

urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("register/", RegisterView.as_view(), name="register"),
    path("change-password/", ChangePasswordView.as_view(), name="change_password"),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot_password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset_password"),
    path("users/", UserManagementListView.as_view(), name="user_management_list"),
    path("users/<int:pk>/", UserManagementDetailView.as_view(), name="user_management_detail"),
]
