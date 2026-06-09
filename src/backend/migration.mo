/// Migration module for the TaxCore backend canister.
///
/// Handles the schema evolution of `migState` from the previously deployed
/// version (4 fields) to the new version (6 fields: adds autoAssignRan and
/// autoAssignVersion).
///
/// Old stable type (previously deployed):
///   { var migrated; var adminFirmId; var migratedRecords; var migrationVersion }
///
/// New stable type:
///   { var migrated; var adminFirmId; var migratedRecords; var migrationVersion;
///     var autoAssignRan; var autoAssignVersion }
import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {

  // ─── Shared primitive aliases ─────────────────────────────────────────────
  type FirmId = Text;

  // ─── Entity types (same shape as main.mo) ───────────────────────────────
  type ClientId = Nat;
  type DocumentInwardId = Nat;
  type WorkProcessingId = Nat;
  type OutwardDocumentId = Nat;
  type InvoiceId = Nat;
  type ActivityLogId = Nat;

  type Client = {
    id : ClientId; name : Text; pan : Text; mobile : Text; email : Text;
    clientType : Text; sourceOfIncome : Text; createdAt : Int;
    createdBy : Text; firmId : Text;
  };
  type DocumentInward = {
    id : DocumentInwardId; clientId : ClientId; dateOfReceipt : Text;
    mode : Text; documentStatus : Text; remarks : Text; firmId : Text;
  };
  type WorkProcessing = {
    id : WorkProcessingId; clientId : ClientId; filingStatus : Text;
    itrFormType : Text; ackNumber : Text; dateOfFiling : Text;
    dueDateOfFiling : Text; firmId : Text;
  };
  type OutwardDocument = {
    id : OutwardDocumentId; clientId : ClientId; outwardStatus : Text;
    readyDate : Text; firmId : Text;
  };
  type Invoice = {
    id : InvoiceId; clientId : ClientId; invoiceNumber : Text; amount : Nat;
    generatedAt : Int; generatedBy : Text; paid : Bool; firmId : Text;
  };
  type ActivityLog = {
    id : ActivityLogId; timestamp : Int; userId : Text; userName : Text;
    role : Text; action : Text; details : Text; clientId : Text; firmId : Text;
  };
  type UserProfile = {
    name : Text;
    role : Text;
    email : Text;
    firmId : Text;
  };

  // ─── Firm-related types ────────────────────────────────────────────────────
  type FirmSummary = {
    firmId       : FirmId;
    firmName     : Text;
    ownerName    : Text;
    ownerEmail   : Text;
    ownerMobile  : Text;
    planType     : Text;
    status       : Text;
    clientCount  : Nat;
    lastLogin    : Int;
    firmNumber   : Text;
  };

  type OldMigrationState = {
    var migrated         : Bool;
    var adminFirmId      : FirmId;
    var migratedRecords  : Nat;
    var migrationVersion : Nat;
  };

  type FirmNumberState = {
    var nextCounter : Nat;
  };

  // ─── OldActor: stable fields from the previously deployed canister ──────────
  type OldActor = {
    firmAppData      : Map.Map<FirmId, Text>;
    firmUserData     : Map.Map<FirmId, Text>;
    firmRegistry     : Map.Map<FirmId, FirmSummary>;
    migState         : OldMigrationState;
    firmNumState     : FirmNumberState;
    userProfiles     : Map.Map<Principal, UserProfile>;
    firmOwners       : Map.Map<Text, Principal>;
    firmClientCounts : Map.Map<Text, Nat>;
    trialModeFirms   : Map.Map<Text, Bool>;
    clients          : Map.Map<ClientId, Client>;
    documentInwards  : Map.Map<DocumentInwardId, DocumentInward>;
    workProcessings  : Map.Map<WorkProcessingId, WorkProcessing>;
    outwardDocuments : Map.Map<OutwardDocumentId, OutwardDocument>;
    invoices         : Map.Map<InvoiceId, Invoice>;
    activityLogs     : Map.Map<ActivityLogId, ActivityLog>;
    var nextClientId          : Nat;
    var nextDocumentInwardId  : Nat;
    var nextWorkProcessingId  : Nat;
    var nextOutwardDocumentId : Nat;
    var nextInvoiceId         : Nat;
    var nextActivityLogId     : Nat;
    var globalUserDb  : Text;
    var globalAppData : Text;
  };

  // ─── New MigrationState with two extra fields ─────────────────────────────
  type NewMigrationState = {
    var migrated          : Bool;
    var adminFirmId       : FirmId;
    var migratedRecords   : Nat;
    var migrationVersion  : Nat;
    var autoAssignRan     : Bool;
    var autoAssignVersion : Nat;
  };

  // ─── NewActor: same as OldActor with upgraded migState ───────────────────
  type NewActor = {
    firmAppData      : Map.Map<FirmId, Text>;
    firmUserData     : Map.Map<FirmId, Text>;
    firmRegistry     : Map.Map<FirmId, FirmSummary>;
    migState         : NewMigrationState;
    firmNumState     : FirmNumberState;
    userProfiles     : Map.Map<Principal, UserProfile>;
    firmOwners       : Map.Map<Text, Principal>;
    firmClientCounts : Map.Map<Text, Nat>;
    trialModeFirms   : Map.Map<Text, Bool>;
    clients          : Map.Map<ClientId, Client>;
    documentInwards  : Map.Map<DocumentInwardId, DocumentInward>;
    workProcessings  : Map.Map<WorkProcessingId, WorkProcessing>;
    outwardDocuments : Map.Map<OutwardDocumentId, OutwardDocument>;
    invoices         : Map.Map<InvoiceId, Invoice>;
    activityLogs     : Map.Map<ActivityLogId, ActivityLog>;
    var nextClientId          : Nat;
    var nextDocumentInwardId  : Nat;
    var nextWorkProcessingId  : Nat;
    var nextOutwardDocumentId : Nat;
    var nextInvoiceId         : Nat;
    var nextActivityLogId     : Nat;
    var globalUserDb  : Text;
    var globalAppData : Text;
  };

  /// Migration function called once on canister upgrade.
  /// Copies every existing field unchanged and provides default values for the
  /// two new MigrationState fields: autoAssignRan = false, autoAssignVersion = 0.
  public func run(old : OldActor) : NewActor {
    {
      firmAppData      = old.firmAppData;
      firmUserData     = old.firmUserData;
      firmRegistry     = old.firmRegistry;
      migState         = {
        var migrated          = old.migState.migrated;
        var adminFirmId       = old.migState.adminFirmId;
        var migratedRecords   = old.migState.migratedRecords;
        var migrationVersion  = old.migState.migrationVersion;
        var autoAssignRan     = false;
        var autoAssignVersion = 0;
      };
      firmNumState     = old.firmNumState;
      userProfiles     = old.userProfiles;
      firmOwners       = old.firmOwners;
      firmClientCounts = old.firmClientCounts;
      trialModeFirms   = old.trialModeFirms;
      clients          = old.clients;
      documentInwards  = old.documentInwards;
      workProcessings  = old.workProcessings;
      outwardDocuments = old.outwardDocuments;
      invoices         = old.invoices;
      activityLogs     = old.activityLogs;
      var nextClientId          = old.nextClientId;
      var nextDocumentInwardId  = old.nextDocumentInwardId;
      var nextWorkProcessingId  = old.nextWorkProcessingId;
      var nextOutwardDocumentId = old.nextOutwardDocumentId;
      var nextInvoiceId         = old.nextInvoiceId;
      var nextActivityLogId     = old.nextActivityLogId;
      var globalUserDb          = old.globalUserDb;
      var globalAppData         = old.globalAppData;
    };
  };

};
