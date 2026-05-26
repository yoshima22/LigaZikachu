import { RegistrationStatus, Role } from "@prisma/client";

interface DeckDeadlineInput {
  deckLockAt?: Date | null;
  lockAt?: Date | null;
  endDate?: Date | null;
}

interface DeckAccessInput {
  viewerRole: Role;
  isOwner: boolean;
  registrationStatus?: RegistrationStatus | null;
  week: DeckDeadlineInput;
  now?: Date;
}

interface DeckSubmitInput {
  viewerRole: Role;
  registrationStatus?: RegistrationStatus | null;
  week: DeckDeadlineInput;
  now?: Date;
}

export function getDeckSubmissionDeadline(week: DeckDeadlineInput) {
  return week.deckLockAt ?? week.lockAt ?? week.endDate ?? null;
}

export function isDeckRegistrationLocked(week: DeckDeadlineInput, now: Date = new Date()) {
  const deadline = getDeckSubmissionDeadline(week);
  return Boolean(deadline && now >= deadline);
}

export function canSubmitTournamentWeekDeck({
  viewerRole,
  registrationStatus,
  week,
  now = new Date()
}: DeckSubmitInput) {
  if (isAdminRole(viewerRole)) return true;

  return isActiveRegistration(registrationStatus) && !isDeckRegistrationLocked(week, now);
}

export function canViewTournamentWeekDecklist({
  viewerRole,
  isOwner,
  registrationStatus,
  week,
  now = new Date()
}: DeckAccessInput) {
  if (isAdminRole(viewerRole)) return true;
  if (isOwner) return true;

  return isActiveRegistration(registrationStatus) && isDeckRegistrationLocked(week, now);
}

export function getDeckVisibilityState(week: DeckDeadlineInput, now: Date = new Date()) {
  const deadline = getDeckSubmissionDeadline(week);
  const locked = isDeckRegistrationLocked(week, now);

  return {
    deadline,
    locked,
    label: !deadline ? "Sem prazo definido" : locked ? "Listas liberadas" : "Listas ocultas ate o fechamento"
  };
}

function isActiveRegistration(status?: RegistrationStatus | null) {
  return status === RegistrationStatus.APPROVED || status === RegistrationStatus.PENDING;
}

function isAdminRole(role: Role) {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}
