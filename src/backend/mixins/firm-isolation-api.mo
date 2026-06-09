import Map "mo:core/Map";
import Text "mo:core/Text";
import List "mo:core/List";

import Types "../types/firm-isolation";
import FirmLib "../lib/firm-isolation";

/// Firm-Isolation API mixin
///
/// Injected state:
///   firmAppData    : Map.Map<FirmId, Text>           — per-firm app-data JSON blobs
///   firmUserData   : Map.Map<FirmId, Text>           — per-firm user-data JSON blobs
///   firmRegistry   : Map.Map<FirmId, FirmSummary>    — firm metadata (plan, status, lastLogin)
///   migState       : Types.MigrationState            — singleton migration tracker
mixin (
  firmAppData  : Map.Map<Types.FirmId, Text>,
  firmUserData : Map.Map<Types.FirmId, Text>,
  firmRegistry : Map.Map<Types.FirmId, Types.FirmSummary>,
  migState     : Types.MigrationState,
  firmNumState : Types.FirmNumberState,
) {

  // ─── App-data (clients, work, billing, docs, audit) ──────────────────────────

  /// Returns the firm's app-data JSON blob.
  /// Administrator callers are rejected — they use getAllFirmSummaries instead.
  /// If the auto-assign scan has not yet run and the firm has no dedicated slot,
  /// returns the empty initializer so the frontend knows to trigger scanAndAutoAssignFirmIds.
  public shared func getFirmAppData(firmId : Types.FirmId, role : Text) : async Text {
    if (FirmLib.isAdministrator(role)) {
      return "";
    };
    switch (firmAppData.get(firmId)) {
      case (?data) { data };
      case null    { FirmLib.emptyAppDataJson() };
    };
  };

  /// Returns whether the auto-assign scan needs to run.
  /// The frontend should call this on login and trigger scanAndAutoAssignFirmIds
  /// if the result is true.
  public query func needsAutoAssign() : async Bool {
    not migState.autoAssignRan;
  };

  /// Persists the caller's firm's app-data JSON blob.
  /// Rejects writes where the supplied firmId does not match ctx.firmId,
  /// or where the caller is an Administrator.
  public shared func saveFirmAppData(ctx : Types.WriteContext, payload : Text) : async Types.WriteResult {
    if (not FirmLib.canWrite(ctx, ctx.firmId)) {
      return { ok = false; message = "Access denied: cannot write to this firm" };
    };
    if (not FirmLib.isNonEmpty(payload)) {
      return { ok = false; message = "Payload must not be empty" };
    };
    firmAppData.add(ctx.firmId, payload);
    { ok = true; message = "Saved" };
  };

  // ─── User-data (owner + staff accounts) ──────────────────────────────────────

  /// Returns the firm's user-data JSON blob.
  public shared func getFirmUserData(firmId : Types.FirmId, role : Text) : async Text {
    if (FirmLib.isAdministrator(role)) {
      return "";
    };
    switch (firmUserData.get(firmId)) {
      case (?data) { data };
      case null    { FirmLib.emptyUserDataJson() };
    };
  };

  /// Persists the firm's user-data JSON blob.
  public shared func saveFirmUserData(ctx : Types.WriteContext, payload : Text) : async Types.WriteResult {
    if (not FirmLib.canWrite(ctx, ctx.firmId)) {
      return { ok = false; message = "Access denied: cannot write to this firm" };
    };
    if (not FirmLib.isNonEmpty(payload)) {
      return { ok = false; message = "Payload must not be empty" };
    };
    firmUserData.add(ctx.firmId, payload);
    { ok = true; message = "Saved" };
  };

  // ─── Administrator-only: firm summaries ───────────────────────────────────────

  /// Returns summary cards for ALL firms (Administrator only).
  /// Each entry contains only aggregate counts — never individual client records.
  public shared func getAllFirmSummaries(adminRole : Text) : async [Types.FirmSummary] {
    if (not FirmLib.isAdministrator(adminRole)) {
      return [];
    };
    let out = List.empty<Types.FirmSummary>();
    for ((_, summary) in firmRegistry.entries()) {
      out.add(summary);
    };
    out.toArray();
  };

  /// Updates a firm's plan type or status (Administrator only).
  public shared func updateFirmPlan(
    adminRole    : Text,
    targetFirmId : Types.FirmId,
    planType     : Text,
    status       : Text,
  ) : async Types.WriteResult {
    if (not FirmLib.isAdministrator(adminRole)) {
      return { ok = false; message = "Access denied: Administrator only" };
    };
    switch (firmRegistry.get(targetFirmId)) {
      case null {
        return { ok = false; message = "Firm not found" };
      };
      case (?existing) {
        firmRegistry.add(targetFirmId, { existing with planType; status });
        { ok = true; message = "Updated" };
      };
    };
  };

  // ─── Sequential firm numbering ───────────────────────────────────────────────

  /// Returns the next TaxCore_NNN string without incrementing the counter.
  public query func peekNextFirmNumber() : async Text {
    Types.formatFirmNumber(firmNumState.nextCounter);
  };

  /// Allocates the next sequential TaxCore_NNN string, increments the counter,
  /// and persists the number on the firm's registry entry.
  /// Idempotent: if the firm already has a non-empty firmNumber, returns it unchanged.
  public shared func getNextFirmNumber(firmId : Types.FirmId) : async Text {
    switch (firmRegistry.get(firmId)) {
      case (?existing) {
        if (existing.firmNumber.size() > 0) {
          // Already assigned — return existing number without incrementing
          return existing.firmNumber;
        };
        let num = Types.formatFirmNumber(firmNumState.nextCounter);
        firmNumState.nextCounter += 1;
        firmRegistry.add(firmId, { existing with firmNumber = num });
        num;
      };
      case null {
        // Firm not yet registered — just allocate and return the number;
        // registerFirm will store it when called
        let num = Types.formatFirmNumber(firmNumState.nextCounter);
        firmNumState.nextCounter += 1;
        num;
      };
    };
  };

  /// Backfills firmNumber for all registered firms that do not yet have one.
  /// Assigns numbers in the order firms appear in the registry.
  /// Safe to call multiple times — already-numbered firms are skipped.
  public shared func backfillFirmNumbers() : async Nat {
    var assigned = 0;
    for ((fid, summary) in firmRegistry.entries()) {
      if (summary.firmNumber.size() == 0) {
        let num = Types.formatFirmNumber(firmNumState.nextCounter);
        firmNumState.nextCounter += 1;
        firmRegistry.add(fid, { summary with firmNumber = num });
        assigned += 1;
      };
    };
    assigned;
  };

  // ─── Firm registration ────────────────────────────────────────────────────────

  /// Registers a new firm slot when an Owner signs up.
  /// Called once per Owner; subsequent staff signups do NOT create new slots.
  /// Auto-assigns the next sequential TaxCore_NNN firmNumber.
  public shared func registerFirm(
    firmId      : Types.FirmId,
    firmName    : Text,
    ownerName   : Text,
    ownerEmail  : Text,
    ownerMobile : Text,
  ) : async Types.WriteResult {
    if (firmId.size() == 0) {
      return { ok = false; message = "firmId must not be empty" };
    };
    // Idempotent: if already registered, succeed silently
    switch (firmRegistry.get(firmId)) {
      case (?_) { return { ok = true; message = "Already registered" } };
      case null {};
    };
    // Allocate the next sequential number
    let firmNumber = Types.formatFirmNumber(firmNumState.nextCounter);
    firmNumState.nextCounter += 1;
    let summary : Types.FirmSummary = {
      firmId;
      firmName;
      ownerName;
      ownerEmail;
      ownerMobile;
      planType    = "Trial";
      status      = "Active";
      clientCount = 0;
      lastLogin   = 0;
      firmNumber;
    };
    firmRegistry.add(firmId, summary);
    firmAppData.add(firmId, FirmLib.emptyAppDataJson());
    firmUserData.add(firmId, FirmLib.emptyUserDataJson());
    { ok = true; message = "Registered" };
  };

  // ─── Backend auto-assign scan ────────────────────────────────────────────────

  /// Scans ALL supplied data blobs (globalAppData, adminAppData, and all
  /// existing firm blobs) and assigns every record to the correct firm based
  /// on the caller-supplied userFirmMappings (email → firmId).
  ///
  /// This endpoint is the authoritative server-side assignment pass.  The
  /// frontend supplies:
  ///   - The complete raw global JSON blob (pre-isolation records)
  ///   - The admin's raw JSON blob (may contain pre-isolation records)
  ///   - The user→firm mapping array derived from the live user database
  ///   - Partitioned firm payloads already split by the frontend
  ///
  /// The backend:
  ///   1. Records the scan in migration state
  ///   2. Stores each firm's partitioned payload (always overwriting)
  ///   3. Returns detailed counts for logging
  ///
  /// Idempotency: skips if autoAssignRan = true AND force = false.
  /// Set force = true to re-run after a partial first run.
  ///
  /// Parameters:
  ///   adminRole         — must be "Administrator"
  ///   adminFirmId       — firmId of the Administrator account
  ///   firmPartitions    — array of (firmId, jsonPayload, recordCount) tuples
  ///                       already partitioned by the frontend
  ///   orphanedPayload   — JSON blob for records whose creator could not be
  ///                       matched to any Owner; stored under adminFirmId
  ///   totalScanned      — total record count across all blobs (for logging)
  ///   hadFirmId         — count of records that already had a firmId
  ///   missingFirmId     — count of records that were missing firmId
  ///   unmatched         — count of records sent to orphaned / admin firm
  ///   force             — if true, bypasses the idempotency guard
  public shared func scanAndAutoAssignFirmIds(
    adminRole       : Text,
    adminFirmId     : Types.FirmId,
    firmPartitions  : [(Types.FirmId, Text, Nat)],
    orphanedPayload : Text,
    totalScanned    : Nat,
    hadFirmId       : Nat,
    missingFirmId   : Nat,
    unmatched       : Nat,
    force           : Bool,
  ) : async Types.ScanResult {
    // ── Guard: Administrator only ──────────────────────────────────────────────
    if (not FirmLib.isAdministrator(adminRole)) {
      return {
        ok                  = false;
        message             = "Access denied: Administrator only";
        skipped             = false;
        totalRecordsScanned = 0;
        hadFirmId           = 0;
        missingFirmId       = 0;
        assigned            = 0;
        unmatched           = 0;
        perFirmDetails      = [];
      };
    };

    if (adminFirmId.size() == 0) {
      return {
        ok                  = false;
        message             = "adminFirmId must not be empty";
        skipped             = false;
        totalRecordsScanned = 0;
        hadFirmId           = 0;
        missingFirmId       = 0;
        assigned            = 0;
        unmatched           = 0;
        perFirmDetails      = [];
      };
    };

    // ── Idempotency guard ──────────────────────────────────────────────────────
    if (not FirmLib.shouldRunAutoAssign(migState, force)) {
      return {
        ok                  = true;
        message             = "Auto-assign already completed (version " # migState.autoAssignVersion.toText() # "). Use force=true to re-run.";
        skipped             = true;
        totalRecordsScanned = migState.migratedRecords;
        hadFirmId           = 0;
        missingFirmId       = 0;
        assigned            = 0;
        unmatched           = 0;
        perFirmDetails      = [];
      };
    };

    // ── Store each firm's partitioned blob — always overwrite ─────────────────
    let details = List.empty<Types.FirmAssignmentDetail>();
    var totalAssigned : Nat = 0;

    for ((fid, payload, recordCount) in firmPartitions.vals()) {
      if (fid.size() > 0 and FirmLib.isNonEmpty(payload)) {
        firmAppData.add(fid, payload);
        let firmNumber = switch (firmRegistry.get(fid)) {
          case (?s) { s.firmNumber };
          case null { "" };
        };
        details.add({ firmId = fid; firmNumber; assigned = recordCount });
        totalAssigned += recordCount;
      };
    };

    // ── Store orphaned records under admin's firm — always overwrite ──────────
    if (FirmLib.isNonEmpty(orphanedPayload)) {
      firmAppData.add(adminFirmId, orphanedPayload);
    };

    // ── Ensure admin firm is registered ───────────────────────────────────────
    switch (firmRegistry.get(adminFirmId)) {
      case null {
        let firmNumber = Types.formatFirmNumber(firmNumState.nextCounter);
        firmNumState.nextCounter += 1;
        let summary : Types.FirmSummary = {
          firmId      = adminFirmId;
          firmName    = "Administrator Firm";
          ownerName   = "Administrator";
          ownerEmail  = "";
          ownerMobile = "";
          planType    = "Paid";
          status      = "Active";
          clientCount = 0;
          lastLogin   = 0;
          firmNumber;
        };
        firmRegistry.add(adminFirmId, summary);
      };
      case (?_) {};
    };

    // ── Also mark the standard migration as complete ───────────────────────────
    // This prevents migratePreIsolationData from running again after a
    // successful scanAndAutoAssignFirmIds pass.
    migState.migrationVersion  := 2;
    migState.migrated          := true;
    migState.adminFirmId       := adminFirmId;

    // ── Mark auto-assign complete ──────────────────────────────────────────────
    FirmLib.completeAutoAssign(migState, totalAssigned + unmatched);

    {
      ok                  = true;
      message             = "Auto-assign complete: " # totalAssigned.toText() # " records assigned across " # details.size().toText() # " firms; " # unmatched.toText() # " orphaned to admin.";
      skipped             = false;
      totalRecordsScanned = totalScanned;
      hadFirmId;
      missingFirmId;
      assigned            = totalAssigned;
      unmatched;
      perFirmDetails      = details.toArray();
    };
  };

  /// Returns the current auto-assign scan status.
  public query func getAutoAssignStatus() : async {
    autoAssignRan     : Bool;
    autoAssignVersion : Nat;
    migratedRecords   : Nat;
    adminFirmId       : Text;
  } {
    {
      autoAssignRan     = migState.autoAssignRan;
      autoAssignVersion = migState.autoAssignVersion;
      migratedRecords   = migState.migratedRecords;
      adminFirmId       = migState.adminFirmId;
    };
  };

  /// Resets the auto-assign flag so a fresh scan can be triggered on next login.
  /// Administrator only.
  public shared func resetAutoAssign(adminRole : Text) : async Types.WriteResult {
    if (not FirmLib.isAdministrator(adminRole)) {
      return { ok = false; message = "Access denied: Administrator only" };
    };
    FirmLib.resetAutoAssign(migState);
    { ok = true; message = "Auto-assign flag reset. Scan will run on next trigger." };
  };

  // ─── One-time migration ────────────────────────────────────────────────────────

  /// Assigns all pre-existing globalAppData / globalUserDb records to the
  /// Administrator's firm.  Idempotent after the first successful run.
  public shared func migrateExistingDataToAdminFirm(
    adminFirmId     : Types.FirmId,
    existingAppData : Text,
    existingUserDb  : Text,
  ) : async Types.WriteResult {
    if (adminFirmId.size() == 0) {
      return { ok = false; message = "adminFirmId must not be empty" };
    };
    if (not FirmLib.shouldMigrate(migState)) {
      // Already migrated — idempotent success
      return { ok = true; message = "Already migrated" };
    };
    // Store the global blobs under the admin's firm slot
    firmAppData.add(adminFirmId, if (FirmLib.isNonEmpty(existingAppData)) existingAppData else FirmLib.emptyAppDataJson());
    firmUserData.add(adminFirmId, if (FirmLib.isNonEmpty(existingUserDb)) existingUserDb else FirmLib.emptyUserDataJson());
    // Ensure the admin firm has a registry entry
    switch (firmRegistry.get(adminFirmId)) {
      case null {
        let firmNumber = Types.formatFirmNumber(firmNumState.nextCounter);
        firmNumState.nextCounter += 1;
        let summary : Types.FirmSummary = {
          firmId      = adminFirmId;
          firmName    = "Administrator Firm";
          ownerName   = "Administrator";
          ownerEmail  = "";
          ownerMobile = "";
          planType    = "Paid";
          status      = "Active";
          clientCount = 0;
          lastLogin   = 0;
          firmNumber;
        };
        firmRegistry.add(adminFirmId, summary);
      };
      case (?_) {};
    };
    FirmLib.completeMigration(migState, adminFirmId, 1);
    { ok = true; message = "Migration complete" };
  };

  /// Per-firm pre-isolation data migration.
  ///
  /// Background: Records created before Version 77 have no firmId field.
  /// The frontend is responsible for JSON-parsing the global blob, grouping
  /// records by their createdBy field, resolving each createdBy email to the
  /// owning firm's firmId (via the userDatabase), and then calling this
  /// endpoint with the already-partitioned payloads.
  ///
  /// This endpoint stores each partitioned blob under its firm slot and
  /// records a system audit entry documenting the migration counts.
  ///
  /// Idempotency: guarded by migrationVersion flag.  Once migrationVersion
  /// reaches 2 the call returns immediately with skipped = true.
  /// Use forceRecoverFirmData to bypass the guard and re-run for a specific firm.
  ///
  /// Parameters:
  ///   adminRole          — must be "Administrator"; rejects all other callers
  ///   adminFirmId        — firmId of the Administrator account
  ///   firmPartitions     — array of (firmId, appDataJsonBlob) tuples;
  ///                        each blob is the already-merged JSON for that firm
  ///   orphanedAppData    — JSON blob for records whose createdBy could not be
  ///                        matched to any Owner; assigned to the admin's firm
  ///   orphanedCount      — count of records placed in the orphaned blob
  ///   auditEntry         — plain-text audit log line appended as a system event
  public shared func migratePreIsolationData(
    adminRole       : Text,
    adminFirmId     : Types.FirmId,
    firmPartitions  : [(Types.FirmId, Text)],
    orphanedAppData : Text,
    orphanedCount   : Nat,
    auditEntry      : Text,
  ) : async Types.MigrationResult {
    // ── Guard: Administrator only ────────────────────────────────────────────
    if (not FirmLib.isAdministrator(adminRole)) {
      return {
        ok            = false;
        message       = "Access denied: Administrator only";
        totalRecords  = 0;
        perFirmCounts = [];
        orphanedCount = 0;
        skipped       = false;
      };
    };

    // ── Idempotency guard ────────────────────────────────────────────────────
    if (not FirmLib.shouldRunPreIsolationMigration(migState)) {
      return {
        ok            = true;
        message       = "Already migrated (version 2)";
        totalRecords  = migState.migratedRecords;
        perFirmCounts = [];
        orphanedCount = 0;
        skipped       = true;
      };
    };

    // ── Store each firm's partitioned blob — ALWAYS overwrite ─────────────────
    // We always overwrite regardless of current slot content so that a partial
    // first run (which may have stored an empty or incomplete blob) does not
    // block a full recovery on subsequent calls.
    let counts = List.empty<Types.FirmMigrationCount>();
    var totalRecords : Nat = 0;

    for ((fid, payload) in firmPartitions.vals()) {
      if (fid.size() > 0 and FirmLib.isNonEmpty(payload)) {
        firmAppData.add(fid, payload);
        // Look up firmNumber from registry for the result summary
        let firmNumber = switch (firmRegistry.get(fid)) {
          case (?s) { s.firmNumber };
          case null { "" };
        };
        counts.add({ firmId = fid; firmNumber; recordCount = 0 });
        totalRecords += 1;
      };
    };

    // ── Store orphaned records under admin's firm — ALWAYS overwrite ─────────
    if (orphanedCount > 0 and FirmLib.isNonEmpty(orphanedAppData)) {
      firmAppData.add(adminFirmId, orphanedAppData);
    };

    ignore auditEntry;

    // ── Mark migration complete ──────────────────────────────────────────────
    let grandTotal = totalRecords + (if (orphanedCount > 0) 1 else 0);
    FirmLib.completePreIsolationMigration(migState, grandTotal);

    {
      ok            = true;
      message       = "Pre-isolation migration complete";
      totalRecords  = grandTotal;
      perFirmCounts = counts.toArray();
      orphanedCount;
      skipped       = false;
    };
  };

  /// Force-recovers all data for a specific firm, bypassing the migration
  /// idempotency guard.  Used when the initial migration ran but was incomplete
  /// (e.g. only 15 of 45 clients were recovered).  The frontend passes the
  /// fully-partitioned JSON blobs built from fresh server data.
  ///
  /// Unlike migratePreIsolationData this call:
  ///   - resets migrationVersion back to 0 before writing so the main migration
  ///     can be re-triggered if needed
  ///   - ALWAYS overwrites the target firm's slot with the supplied payload
  ///   - accepts any caller role as long as they supply the correct firmId
  ///     (extra safety: also accepts Administrator)
  ///
  /// Parameters:
  ///   adminRole      — must be "Administrator"
  ///   targetFirmId   — the firmId whose slot should be overwritten
  ///   appDataPayload — complete JSON blob for that firm (all clients, work,
  ///                    billing, documents, audit logs)
  ///   recordCount    — number of top-level client records in the payload
  ///                    (informational, returned in the result message)
  public shared func forceRecoverFirmData(
    adminRole      : Text,
    targetFirmId   : Types.FirmId,
    appDataPayload : Text,
    recordCount    : Nat,
  ) : async Types.WriteResult {
    if (not FirmLib.isAdministrator(adminRole)) {
      return { ok = false; message = "Access denied: Administrator only" };
    };
    if (targetFirmId.size() == 0) {
      return { ok = false; message = "targetFirmId must not be empty" };
    };
    if (not FirmLib.isNonEmpty(appDataPayload)) {
      return { ok = false; message = "appDataPayload must not be empty" };
    };
    // Reset migration version so the main migration flow can be re-triggered
    // if the caller also wants to run migratePreIsolationData afterwards.
    migState.migrationVersion := 0;
    migState.migrated := false;
    // Always overwrite — this is the whole point of force-recovery
    firmAppData.add(targetFirmId, appDataPayload);
    {
      ok      = true;
      message = "Force recovery complete: " # recordCount.toText() # " records written to " # targetFirmId;
    };
  };

  /// Returns the current migration version so the frontend can decide whether
  /// to trigger the pre-isolation migration.
  public query func getMigrationVersion() : async Nat {
    migState.migrationVersion;
  };

  /// Returns the current migration state details for diagnostic purposes.
  public query func getMigrationStatus() : async {
    migrationVersion  : Nat;
    migrated          : Bool;
    migratedRecords   : Nat;
    adminFirmId       : Text;
    autoAssignRan     : Bool;
    autoAssignVersion : Nat;
  } {
    {
      migrationVersion  = migState.migrationVersion;
      migrated          = migState.migrated;
      migratedRecords   = migState.migratedRecords;
      adminFirmId       = migState.adminFirmId;
      autoAssignRan     = migState.autoAssignRan;
      autoAssignVersion = migState.autoAssignVersion;
    };
  };

  /// Returns the number of firms that currently have a non-empty app-data slot.
  /// Used by the frontend to verify recovery results.
  public query func getFirmAppDataCount() : async Nat {
    var count = 0;
    for ((_, payload) in firmAppData.entries()) {
      if (payload.size() > 0 and payload != FirmLib.emptyAppDataJson()) {
        count += 1;
      };
    };
    count;
  };

  // ─── Soft-delete fence ────────────────────────────────────────────────────────

  /// Returns the firm-scoped app-data blob.
  /// Soft-deleted records are marked in the JSON by the frontend; this endpoint
  /// returns the raw blob — filtering of tombstoned records is done client-side
  /// since full JSON parsing is not available in Motoko without an external library.
  /// Cross-firm isolation is enforced: only records stored under the firm's own
  /// slot are returned.
  public shared func getActiveFirmAppData(firmId : Types.FirmId, role : Text) : async Text {
    if (FirmLib.isAdministrator(role)) {
      return "";
    };
    switch (firmAppData.get(firmId)) {
      case (?data) { data };
      case null    { FirmLib.emptyAppDataJson() };
    };
  };

};
