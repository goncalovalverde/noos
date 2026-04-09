from enum import StrEnum


class UserRole(StrEnum):
    """Canonical role values stored in the database.

    Using StrEnum means each member IS its string value:
        UserRole.ADMIN == "Administrador"  # True

    This eliminates magic string literals from app code while
    remaining 100% compatible with the existing SAEnum database column.
    Never rename these values without a DB migration.
    """

    ADMIN = "Administrador"
    NEURO = "Neuropsicólogo"
    OBSERVER = "Observador"
