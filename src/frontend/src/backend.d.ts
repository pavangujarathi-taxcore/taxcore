import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface WriteResult {
    ok: boolean;
    message: string;
}
export interface FirmSummary {
    ownerEmail: string;
    status: string;
    ownerName: string;
    firmNumber: string;
    clientCount: bigint;
    firmName: string;
    firmId: FirmId;
    lastLogin: bigint;
    planType: string;
    ownerMobile: string;
}
export interface ScanResult {
    ok: boolean;
    totalRecordsScanned: bigint;
    assigned: bigint;
    skipped: boolean;
    hadFirmId: bigint;
    missingFirmId: bigint;
    unmatched: bigint;
    message: string;
    perFirmDetails: Array<FirmAssignmentDetail>;
}
export interface FirmAssignmentDetail {
    assigned: bigint;
    firmNumber: string;
    firmId: FirmId;
}
export interface MigrationResult {
    ok: boolean;
    perFirmCounts: Array<FirmMigrationCount>;
    skipped: boolean;
    message: string;
    orphanedCount: bigint;
    totalRecords: bigint;
}
export interface FirmMigrationCount {
    firmNumber: string;
    firmId: FirmId;
    recordCount: bigint;
}
export interface WriteContext {
    userId: string;
    role: string;
    firmId: FirmId;
}
export type FirmId = string;
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    backfillFirmNumbers(): Promise<bigint>;
    forceRecoverFirmData(adminRole: string, targetFirmId: FirmId, appDataPayload: string, recordCount: bigint): Promise<WriteResult>;
    getActiveFirmAppData(firmId: FirmId, role: string): Promise<string>;
    getAllFirmSummaries(adminRole: string): Promise<Array<FirmSummary>>;
    getAutoAssignStatus(): Promise<{
        migratedRecords: bigint;
        autoAssignVersion: bigint;
        autoAssignRan: boolean;
        adminFirmId: string;
    }>;
    getCallerUserRole(): Promise<UserRole>;
    getFirmAppData(firmId: FirmId, role: string): Promise<string>;
    getFirmAppDataCount(): Promise<bigint>;
    getFirmUserData(firmId: FirmId, role: string): Promise<string>;
    getGlobalAppData(): Promise<string>;
    getGlobalUserDatabase(): Promise<string>;
    getMigrationStatus(): Promise<{
        migratedRecords: bigint;
        autoAssignVersion: bigint;
        migrated: boolean;
        autoAssignRan: boolean;
        migrationVersion: bigint;
        adminFirmId: string;
    }>;
    getMigrationVersion(): Promise<bigint>;
    getNextFirmNumber(firmId: FirmId): Promise<string>;
    isCallerAdmin(): Promise<boolean>;
    migrateExistingDataToAdminFirm(adminFirmId: FirmId, existingAppData: string, existingUserDb: string): Promise<WriteResult>;
    migratePreIsolationData(adminRole: string, adminFirmId: FirmId, firmPartitions: Array<[FirmId, string]>, orphanedAppData: string, orphanedCount: bigint, auditEntry: string): Promise<MigrationResult>;
    needsAutoAssign(): Promise<boolean>;
    peekNextFirmNumber(): Promise<string>;
    registerFirm(firmId: FirmId, firmName: string, ownerName: string, ownerEmail: string, ownerMobile: string): Promise<WriteResult>;
    resetAutoAssign(adminRole: string): Promise<WriteResult>;
    saveFirmAppData(ctx: WriteContext, payload: string): Promise<WriteResult>;
    saveFirmUserData(ctx: WriteContext, payload: string): Promise<WriteResult>;
    saveGlobalAppData(json: string): Promise<void>;
    saveGlobalUserDatabase(json: string): Promise<void>;
    scanAndAutoAssignFirmIds(adminRole: string, adminFirmId: FirmId, firmPartitions: Array<[FirmId, string, bigint]>, orphanedPayload: string, totalScanned: bigint, hadFirmId: bigint, missingFirmId: bigint, unmatched: bigint, force: boolean): Promise<ScanResult>;
    updateFirmPlan(adminRole: string, targetFirmId: FirmId, planType: string, status: string): Promise<WriteResult>;
}
