"""Помилки бізнес-логіки. Обробник у winterra/exception_handler.py перетворює їх на HTTP-відповіді."""


class BookingError(Exception):
    status_code = 400
    default_code = "booking_error"

    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.message = message
        self.code = code or self.default_code


class ValidationFailed(BookingError):
    default_code = "invalid_selection"


class NotFound(BookingError):
    status_code = 404
    default_code = "not_found"


class NotEnoughSeats(BookingError):
    status_code = 409
    default_code = "not_enough_seats"


class PolicyViolation(BookingError):
    status_code = 409
    default_code = "policy_violation"


class InvalidState(BookingError):
    status_code = 409
    default_code = "invalid_state"


class InvalidSignature(BookingError):
    status_code = 403
    default_code = "invalid_signature"
