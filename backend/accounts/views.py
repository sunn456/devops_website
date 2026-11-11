"""Модуль accounts: вхід і вихід адміністратора (FR-13). Пароль зберігається в хешованому вигляді засобами Django."""
from django.contrib.auth import authenticate
from rest_framework import serializers, status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class LoginView(APIView):
    authentication_classes = []

    def post(self, request):
        s = LoginSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = authenticate(request, **s.validated_data)
        if user is None or not user.is_staff:
            return Response({"detail": "Невірний логін або пароль."}, status=status.HTTP_401_UNAUTHORIZED)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "username": user.username})


class LogoutView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response({"username": request.user.username})
