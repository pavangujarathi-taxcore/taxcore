
module {

  // ─── Firm identity ───────────────────────────────────────────────────────────

  /// Opaque firm identifier — a non-empty string assigned at Owner signup.
  /// All data records carry this field so the backend can enforce isolation.
  public type FirmId = Text;

  /// Lightweight summary of a firm returned to the Administrator.
  /// Never exposes individual client records.
  public type FirmSummary = {
    firmId       : FirmId;
    firmName     : Text;
    ownerName    : Text;
    ownerEmail   : Text;
    ownerMobile  : Text;
    planType     : Text;   // "Trial" | "Paid"
    status       : Text;   // "Active" | "Disabled"
    clientCount  : Nat;
    lastLogin    : Int;    // nanoseconds since epoch, 0 if never
    firmNumber   : Text;   // Sequential display ID e.g. "TaxCore_001"; empty string = not yet assigned
  };

  // ─── Per-firm data blobs ─────────────────────────────────────────────────────

  /// A firm's entire app-data payload as a JSON text blob.
  /// The blob structure mirrors the existing globalAppData schema but contains
  /// only records belonging to the specified firm.
  public type FirmAppData = {
    firmId  : FirmId;
    payload : Text;   // JSON — same schema as globalAppData
  };

  /// A firm's user-database slice as a JSON text blob.
  /// Contains only users (owner + staff) belonging to that firm.
  public type FirmUserData = {
    firmId  : FirmId;
    payload : Text;   // JSON — same schema as globalUserDb
  };

  // ─── Request / response envelopes ────────────────────────────────────────────

  /// Caller-supplied context attached to every firm-scoped write.
  public type WriteContext = {
    firmId : FirmId;
    userId : Text;    // email / unique user identifier
    role   : Text;    // "Owner" | "Staff" | "Administrator"
  };

  /// Result wrapper used by mutating operations.
  public type WriteResult = {
    ok      : Bool;
    message : Text;
  };

  // ─── Auto-assignment scan types ─────────────────────────────────────────────

  /// Maps a user's unique identifier (email) to their owning firmId.
  /// Supplied by the frontend which has access to the full user database.
  public type UserFirmMapping = {
    userId    : Text;   // email or unique user ID used as createdBy
    firmId    : FirmId;
  };

  /// Per-firm assignment result used in ScanResult.
  public type FirmAssignmentDetail = {
    firmId      : FirmId;
    firmNumber  : Text;
    assigned    : Nat;   // records assigned to this firm in this scan
  };

  /// Detailed result returned by scanAndAutoAssignFirmIds.
  public type ScanResult = {
    ok                  : Bool;
    message             : Text;
    skipped             : Bool;  // true if auto-assign already ran and force = false
    totalRecordsScanned : Nat;   // total records found across all blobs
    hadFirmId           : Nat;   // records that already carried a firmId
    missingFirmId       : Nat;   // records without firmId that needed assignment
    assigned            : Nat;   // records successfully assigned to a firm
    unmatched           : Nat;   // records whose creator could not be matched (sent to admin)
    perFirmDetails      : [FirmAssignmentDetail];
  };

  // ─── Migration helpers ───────────────────────────────────────────────────────

  /// Tracks whether the one-time data migration (assigning all existing records
  /// to the Administrator's firm) has been executed.
  public type MigrationState = {
    var migrated              : Bool;
    var adminFirmId           : FirmId;
    var migratedRecords       : Nat;
    var migrationVersion      : Nat;   // 0 = never run, 1 = V77 admin-only, 2 = V78 per-firm
    var autoAssignRan         : Bool;  // true once scanAndAutoAssignFirmIds completed successfully
    var autoAssignVersion     : Nat;   // bumped each time a full auto-assign scan completes
  };

  public func initMigrationState() : MigrationState {
    {
      var migrated          = false;
      var adminFirmId       = "";
      var migratedRecords   = 0;
      var migrationVersion  = 0;
      var autoAssignRan     = false;
      var autoAssignVersion = 0;
    };
  };

  /// Per-firm record counts returned from migratePreIsolationData.
  public type FirmMigrationCount = {
    firmId       : FirmId;
    firmNumber   : Text;
    recordCount  : Nat;
  };

  /// Full summary returned by migratePreIsolationData.
  public type MigrationResult = {
    ok              : Bool;
    message         : Text;
    totalRecords    : Nat;
    perFirmCounts   : [FirmMigrationCount];
    orphanedCount   : Nat;
    skipped         : Bool;   // true when migration was already run (idempotent)
  };

  /// Mutable counter for sequential firm numbering.
  /// Stored as a record so it can be shared by reference with the mixin.
  public type FirmNumberState = {
    var nextCounter : Nat;  // starts at 1; increments on each new firm assignment
  };

  public func initFirmNumberState() : FirmNumberState {
    { var nextCounter = 1 };
  };

  /// Formats a counter value as the canonical TaxCore_NNN display string.
  public func formatFirmNumber(n : Nat) : Text {
    let s = n.toText();
    let padded = if (s.size() >= 3) s
                 else if (s.size() == 2) "0" # s
                 else "00" # s;
    "TaxCore_" # padded;
  };

};
