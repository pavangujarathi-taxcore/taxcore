import Text "mo:core/Text";

import Types "../types/firm-isolation";

module {

  // ─── Access validation ───────────────────────────────────────────────────────

  /// Returns true when the caller's firmId matches the target firmId.
  public func isSameFirm(callerFirmId : Types.FirmId, targetFirmId : Types.FirmId) : Bool {
    callerFirmId == targetFirmId;
  };

  /// Returns true when the caller is an Administrator.
  public func isAdministrator(role : Text) : Bool {
    role == "Administrator";
  };

  /// Returns true when the caller's role permits a write to the given firm.
  /// Administrators CANNOT write individual firm records; only Owner/Staff can.
  public func canWrite(ctx : Types.WriteContext, targetFirmId : Types.FirmId) : Bool {
    // Administrators are blocked from record-level writes
    if (isAdministrator(ctx.role)) { return false };
    isSameFirm(ctx.firmId, targetFirmId);
  };

  /// Returns true when the caller may read firm-scoped data.
  /// Owner/Staff: only their own firmId.
  /// Administrator: allowed for any firmId (summary reads only; API layer enforces no record detail).
  public func canRead(ctx : Types.WriteContext, targetFirmId : Types.FirmId) : Bool {
    if (isAdministrator(ctx.role)) { return true };
    isSameFirm(ctx.firmId, targetFirmId);
  };

  // ─── JSON blob helpers ───────────────────────────────────────────────────────

  /// Validates that a JSON payload string is non-empty.
  public func isNonEmpty(payload : Text) : Bool {
    payload.size() > 0;
  };

  /// Returns a safe empty-data JSON string for initialising a new firm's app-data slot.
  public func emptyAppDataJson() : Text {
    "{\"clients\":[],\"documents\":[],\"work\":[],\"billing\":[],\"auditLogs\":[]}";
  };

  /// Returns a safe empty-data JSON string for initialising a new firm's user-data slot.
  public func emptyUserDataJson() : Text {
    "{\"users\":[],\"firmAccounts\":[],\"superAdminCreated\":false,\"whatsAppSettings\":{}}";
  };

  // ─── Migration helpers ───────────────────────────────────────────────────────

  /// Returns true only when migration has not yet run and adminFirmId is set.
  public func shouldMigrate(state : Types.MigrationState) : Bool {
    not state.migrated and state.adminFirmId.size() > 0;
  };

  /// Returns true when the per-firm pre-isolation migration (version 2) has not yet run.
  public func shouldRunPreIsolationMigration(state : Types.MigrationState) : Bool {
    state.migrationVersion < 2;
  };

  /// Returns true when the auto-assign scan should run.
  /// Runs if it has never succeeded, or if force = true.
  public func shouldRunAutoAssign(state : Types.MigrationState, force : Bool) : Bool {
    force or not state.autoAssignRan;
  };

  /// Marks the migration as completed.
  public func completeMigration(
    state       : Types.MigrationState,
    adminFirmId : Types.FirmId,
    count       : Nat,
  ) : () {
    state.migrated        := true;
    state.adminFirmId     := adminFirmId;
    state.migratedRecords := count;
  };

  /// Marks the per-firm pre-isolation migration as completed (version 2).
  public func completePreIsolationMigration(
    state        : Types.MigrationState,
    totalRecords : Nat,
  ) : () {
    state.migrated        := true;
    state.migratedRecords := totalRecords;
    state.migrationVersion := 2;
  };

  /// Marks the auto-assign scan as completed.
  public func completeAutoAssign(
    state        : Types.MigrationState,
    totalAssigned : Nat,
  ) : () {
    state.autoAssignRan     := true;
    state.autoAssignVersion += 1;
    state.migratedRecords   := totalAssigned;
  };

  /// Resets the migration version back to 0 so a force-recovery pass can
  /// re-run the full migration if needed.
  public func resetMigrationState(state : Types.MigrationState) : () {
    state.migrated        := false;
    state.migratedRecords := 0;
    state.migrationVersion := 0;
  };

  /// Resets the auto-assign flag so a fresh scan can be triggered.
  public func resetAutoAssign(state : Types.MigrationState) : () {
    state.autoAssignRan := false;
  };

};
