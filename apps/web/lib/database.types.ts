/**
 * Hand-authored to match supabase/migrations/0001_init.sql. Once a real
 * Supabase project is linked, regenerate with:
 *   supabase gen types typescript --linked > lib/database.types.ts
 * and this file becomes generated rather than hand-maintained.
 */

export type EmploymentStatus = "active" | "leave" | "inactive" | "terminated";
export type CredentialCategory = "training" | "background_check" | "document" | "other";
export type RenewalIntervalUnit = "days" | "months" | "years";
export type EmployeeCredentialStatus = "active" | "archived";
export type RoleKey = "owner" | "office_manager" | "employee";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
        };
        Update: Partial<{ name: string; slug: string }>;
        Relationships: [];
      };
      organization_settings: {
        Row: {
          organization_id: string;
          compliance_yellow_threshold_days: number;
          compliance_orange_threshold_days: number;
          notify_schedule_days: number[];
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          compliance_yellow_threshold_days?: number;
          compliance_orange_threshold_days?: number;
          notify_schedule_days?: number[];
          timezone?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organization_settings"]["Row"]>;
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          key: RoleKey;
          name: string;
          description: string | null;
          is_system: boolean;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      organization_users: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role_id: string;
          employee_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role_id: string;
          employee_id?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["organization_users"]["Row"]>;
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: { id?: string; organization_id: string; name: string };
        Update: Partial<{ name: string }>;
        Relationships: [];
      };
      positions: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: { id?: string; organization_id: string; name: string; description?: string | null };
        Update: Partial<{ name: string; description: string | null }>;
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          organization_id: string;
          employee_number: string;
          first_name: string;
          middle_name: string | null;
          last_name: string;
          preferred_name: string | null;
          date_of_hire: string;
          position_id: string | null;
          department_id: string | null;
          supervisor_id: string | null;
          employment_status: EmploymentStatus;
          phone: string | null;
          email: string | null;
          photo_url: string | null;
          notes: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_number: string;
          first_name: string;
          middle_name?: string | null;
          last_name: string;
          preferred_name?: string | null;
          date_of_hire: string;
          position_id?: string | null;
          department_id?: string | null;
          supervisor_id?: string | null;
          employment_status?: EmploymentStatus;
          phone?: string | null;
          email?: string | null;
          photo_url?: string | null;
          notes?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Insert"]>;
        Relationships: [];
      };
      credential_types: {
        Row: {
          id: string;
          organization_id: string;
          key: string;
          name: string;
          description: string | null;
          category: CredentialCategory;
          renewal_interval_value: number | null;
          renewal_interval_unit: RenewalIntervalUnit | null;
          requires_document: boolean;
          is_required_default: boolean;
          warning_yellow_threshold_days: number | null;
          warning_orange_threshold_days: number | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          key: string;
          name: string;
          description?: string | null;
          category?: CredentialCategory;
          renewal_interval_value?: number | null;
          renewal_interval_unit?: RenewalIntervalUnit | null;
          requires_document?: boolean;
          is_required_default?: boolean;
          warning_yellow_threshold_days?: number | null;
          warning_orange_threshold_days?: number | null;
          is_active?: boolean;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["credential_types"]["Insert"]>;
        Relationships: [];
      };
      position_requirements: {
        Row: {
          id: string;
          organization_id: string;
          position_id: string;
          credential_type_id: string;
          is_required: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          position_id: string;
          credential_type_id: string;
          is_required?: boolean;
        };
        Update: Partial<{ is_required: boolean }>;
        Relationships: [];
      };
      employee_credentials: {
        Row: {
          id: string;
          organization_id: string;
          employee_id: string;
          credential_type_id: string;
          status: EmployeeCredentialStatus;
          completion_date: string | null;
          issue_date: string | null;
          expiration_date: string | null;
          certificate_number: string | null;
          issuing_organization: string | null;
          notes: string | null;
          verified_by: string | null;
          verified_at: string | null;
          expiration_override: boolean;
          expiration_override_reason: string | null;
          superseded_by: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_id: string;
          credential_type_id: string;
          status?: EmployeeCredentialStatus;
          completion_date?: string | null;
          issue_date?: string | null;
          expiration_date?: string | null;
          certificate_number?: string | null;
          issuing_organization?: string | null;
          notes?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          expiration_override?: boolean;
          expiration_override_reason?: string | null;
          superseded_by?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["employee_credentials"]["Insert"]>;
        Relationships: [];
      };
      credential_documents: {
        Row: {
          id: string;
          organization_id: string;
          employee_credential_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          is_current: boolean;
          uploaded_by: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          employee_credential_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          is_current?: boolean;
          uploaded_by?: string | null;
        };
        Update: Partial<{ is_current: boolean }>;
        Relationships: [];
      };
      notification_rules: {
        Row: {
          id: string;
          organization_id: string;
          credential_type_id: string | null;
          days_before: number[];
          notify_roles: string[];
          notify_employee: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          credential_type_id?: string | null;
          days_before?: number[];
          notify_roles?: string[];
          notify_employee?: boolean;
          is_active?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["notification_rules"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          recipient_user_id: string;
          employee_id: string | null;
          employee_credential_id: string | null;
          type: string;
          title: string;
          body: string;
          severity: string;
          channel: string[];
          is_read: boolean;
          dedupe_key: string | null;
          sent_at: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          recipient_user_id: string;
          employee_id?: string | null;
          employee_credential_id?: string | null;
          type: string;
          title: string;
          body: string;
          severity?: string;
          channel?: string[];
          is_read?: boolean;
          dedupe_key?: string | null;
          sent_at?: string | null;
        };
        Update: Partial<{ is_read: boolean; read_at: string | null }>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          affected_employee_id: string | null;
          previous_value: Record<string, unknown> | null;
          new_value: Record<string, unknown> | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          affected_employee_id?: string | null;
          previous_value?: Record<string, unknown> | null;
          new_value?: Record<string, unknown> | null;
          metadata?: Record<string, unknown> | null;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      renew_employee_credential: {
        Args: {
          p_employee_id: string;
          p_credential_type_id: string;
          p_completion_date: string;
          p_issue_date: string | null;
          p_expiration_date: string | null;
          p_certificate_number: string | null;
          p_issuing_organization: string | null;
          p_notes: string | null;
          p_actor_user_id: string;
        };
        Returns: string;
      };
    };
  };
}
