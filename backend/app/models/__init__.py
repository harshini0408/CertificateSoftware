from .club import Club
from .department import Department
from .user import User, UserRole
from .token_blacklist import TokenBlacklist
from .event import Event, EventStatus, EventAssets
from .template import Template, TemplateType, FieldSlot, StaticElement, TemplateBackground
from .participant import Participant, ParticipantSource
from .certificate import Certificate, CertStatus, CertSnapshot
from .cert_sequence import CertSequence
from .email_log import EmailLog, EmailStatus
from .scan_log import ScanLog
from .credit_rule import CreditRule
from .student_credit import StudentCredit, CreditHistoryEntry
from .credit_semester import CreditSemesterState
from .image_template import ImageTemplate
from .field_position import FieldPosition
from .dept_asset import DeptAsset, DeptFieldPosition
from .dept_certificate import DeptCertificate
from .dept_certificate_preview import DeptCertificatePreview
from .dept_event import DeptEvent, DeptEventStatus
from .dept_template import DeptTemplate
from .guest_session import GuestSession
from .faculty_session import FacultySession
from .faculty_certificate import FacultyCertificate
from .faculty_field_position import FacultyFieldPosition
from .role_template_preset import RoleTemplatePreset
from .user_otp import OTPRequest
from .manual_credit_submission import ManualCreditSubmission, ManualSubmissionStatus
from .student_club_membership import StudentClubMembership, MembershipStatus
from .event_registration import EventRegistration
from .attendance import Attendance
from .attendance_session import AttendanceSession
from .professional_society import ProfessionalSociety, SocietyAssets
from .society_event import SocietyEvent, SocietyEventStatus
from .student_society_membership import StudentSocietyMembership, SocietyMembershipStatus
from .society_asset import SocietyAsset
from .society_certificate import SocietyCertificate
from .society_attendance import SocietyAttendance
from .society_attendance_session import SocietyAttendanceSession
from .society_participant import SocietyParticipant
from .society_field_position import SocietyFieldPosition
from ..certificate_config.model import CertificateTemplateConfig

ALL_MODELS = [
    Club,
    Department,
    User,
    TokenBlacklist,
    Event,
    Template,
    Participant,
    Certificate,
    CertSequence,
    EmailLog,
    ScanLog,
    CreditRule,
    StudentCredit,
    CreditSemesterState,
    ImageTemplate,
    FieldPosition,
    DeptAsset,
    DeptCertificate,
    DeptCertificatePreview,
    DeptEvent,
    DeptTemplate,
    GuestSession,
    FacultySession,
    FacultyCertificate,
    FacultyFieldPosition,
    RoleTemplatePreset,
    OTPRequest,
    ManualCreditSubmission,
    StudentClubMembership,
    EventRegistration,
    Attendance,
    AttendanceSession,
    CertificateTemplateConfig,
    ProfessionalSociety,
    SocietyEvent,
    StudentSocietyMembership,
    SocietyAsset,
    SocietyCertificate,
    SocietyAttendance,
    SocietyAttendanceSession,
    SocietyParticipant,
    SocietyFieldPosition,
]

__all__ = [
    "Club",
    "Department",
    "User", "UserRole",
    "TokenBlacklist",
    "Event", "EventStatus", "EventAssets",
    "Template", "TemplateType", "FieldSlot", "StaticElement", "TemplateBackground",
    "Participant", "ParticipantSource",
    "Certificate", "CertStatus", "CertSnapshot",
    "CertSequence",
    "EmailLog", "EmailStatus",
    "ScanLog",
    "CreditRule",
    "StudentCredit", "CreditHistoryEntry",
    "CreditSemesterState",
    "ImageTemplate",
    "FieldPosition",    "DeptAsset", "DeptFieldPosition",
    "DeptCertificate", "DeptCertificatePreview", "DeptTemplate",
    "DeptEvent", "DeptEventStatus",
    "GuestSession",
    "FacultySession",
    "FacultyCertificate",
    "FacultyFieldPosition",
    "RoleTemplatePreset",
    "OTPRequest",
    "ManualCreditSubmission", "ManualSubmissionStatus",
    "StudentClubMembership", "MembershipStatus",
    "Attendance",
    "AttendanceSession",
    "ALL_MODELS",
]
