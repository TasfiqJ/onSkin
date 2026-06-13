/**
 * Supabase `Database` type.
 *
 * BLOCKED: B-SUPABASE — once the project exists, REGENERATE from the live schema:
 *   supabase gen types typescript --project-id <ref> > packages/types/src/database.types.ts
 *
 * Until then this is hand-authored to exactly match `supabase/migrations/`
 * (0001–0016) so the client is fully typed during development. Keep in sync with
 * the migrations.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamptz = string;
type DateStr = string;
type TimeStr = string;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_path: string | null;
          locale: string | null;
          units: string;
          current_streak: number;
          longest_streak: number;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_path?: string | null;
          locale?: string | null;
          units?: string;
          current_streak?: number;
          longest_streak?: number;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      ingredients: {
        Row: {
          id: string;
          inci_name: string;
          display_name: string | null;
          cas_number: string | null;
          ec_number: string | null;
          cosing_ref: string | null;
          annex_status: string | null;
          annex_conditions: string | null;
          source: string;
          imported_at: Timestamptz;
        };
        Insert: {
          id?: string;
          inci_name: string;
          display_name?: string | null;
          cas_number?: string | null;
          ec_number?: string | null;
          cosing_ref?: string | null;
          annex_status?: string | null;
          annex_conditions?: string | null;
          source?: string;
          imported_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['ingredients']['Insert']>;
        Relationships: [];
      };
      ingredient_synonyms: {
        Row: { id: string; ingredient_id: string; synonym: string };
        Insert: { id?: string; ingredient_id: string; synonym: string };
        Update: Partial<Database['public']['Tables']['ingredient_synonyms']['Insert']>;
        Relationships: [];
      };
      ingredient_tags: {
        Row: { ingredient_id: string; tag: string; subflag: string | null };
        Insert: { ingredient_id: string; tag: string; subflag?: string | null };
        Update: Partial<Database['public']['Tables']['ingredient_tags']['Insert']>;
        Relationships: [];
      };
      ingredient_pao_defaults: {
        Row: { category: string; default_pao_months: number; rationale: string | null };
        Insert: { category: string; default_pao_months: number; rationale?: string | null };
        Update: Partial<Database['public']['Tables']['ingredient_pao_defaults']['Insert']>;
        Relationships: [];
      };
      sequencing_rules: {
        Row: {
          id: string;
          role: string;
          base_priority: number;
          am_eligible: boolean;
          pm_eligible: boolean;
          default_phase: string;
          notes: string | null;
          rule_version: number;
          reviewed_by: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          role: string;
          base_priority: number;
          am_eligible?: boolean;
          pm_eligible?: boolean;
          default_phase?: string;
          notes?: string | null;
          rule_version?: number;
          reviewed_by?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['sequencing_rules']['Insert']>;
        Relationships: [];
      };
      active_ramp: {
        Row: {
          id: string;
          user_id: string;
          user_product_id: string;
          ramp_class: string;
          freq_per_week: number;
          target_per_week: number;
          started_at: DateStr;
          last_step_up: DateStr | null;
          next_review_at: DateStr | null;
          tolerance_state: string;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_product_id: string;
          ramp_class: string;
          freq_per_week: number;
          target_per_week: number;
          started_at?: DateStr;
          last_step_up?: DateStr | null;
          next_review_at?: DateStr | null;
          tolerance_state?: string;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['active_ramp']['Insert']>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          barcode: string | null;
          name: string;
          brand: string | null;
          category: string | null;
          default_pao_months: number | null;
          is_curated: boolean;
          source: string;
          source_ref: string | null;
          imported_at: Timestamptz;
        };
        Insert: {
          id?: string;
          barcode?: string | null;
          name: string;
          brand?: string | null;
          category?: string | null;
          default_pao_months?: number | null;
          is_curated?: boolean;
          source?: string;
          source_ref?: string | null;
          imported_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
        Relationships: [];
      };
      product_ingredients: {
        Row: {
          product_id: string;
          ingredient_id: string;
          position: number | null;
          concentration_band: string | null;
        };
        Insert: {
          product_id: string;
          ingredient_id: string;
          position?: number | null;
          concentration_band?: string | null;
        };
        Update: Partial<Database['public']['Tables']['product_ingredients']['Insert']>;
        Relationships: [];
      };
      conflict_rules: {
        Row: {
          id: string;
          tag_a: string;
          tag_b: string;
          interaction_type: string;
          base_severity: string;
          evidence_grade: string | null;
          evidence_label: string;
          mechanism: string;
          resolution_type: string;
          resolution_copy: string;
          applies_when: Json | null;
          source_citation: string;
          rule_version: number;
          reviewed_by: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          tag_a: string;
          tag_b: string;
          interaction_type: string;
          base_severity: string;
          evidence_grade?: string | null;
          evidence_label: string;
          mechanism: string;
          resolution_type: string;
          resolution_copy: string;
          applies_when?: Json | null;
          source_citation: string;
          rule_version?: number;
          reviewed_by?: string | null;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['conflict_rules']['Insert']>;
        Relationships: [];
      };
      routine_conflicts: {
        Row: {
          id: string;
          user_id: string;
          rule_id: string;
          product_a_id: string | null;
          product_b_id: string | null;
          computed_severity: string;
          status: string;
          user_choice: string | null;
          rule_version: number | null;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          rule_id: string;
          product_a_id?: string | null;
          product_b_id?: string | null;
          computed_severity: string;
          status?: string;
          user_choice?: string | null;
          rule_version?: number | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['routine_conflicts']['Insert']>;
        Relationships: [];
      };
      skin_profiles: {
        Row: {
          id: string;
          user_id: string;
          oily_dry: number | null;
          sensitive_resistant: number | null;
          pigmented_non: number | null;
          wrinkled_tight: number | null;
          fitzpatrick: number | null;
          monk_tone: number | null;
          sensitivities: string[];
          pregnancy_status: string | null;
          goals: string[];
          completed_at: Timestamptz | null;
          version: number;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          oily_dry?: number | null;
          sensitive_resistant?: number | null;
          pigmented_non?: number | null;
          wrinkled_tight?: number | null;
          fitzpatrick?: number | null;
          monk_tone?: number | null;
          sensitivities?: string[];
          pregnancy_status?: string | null;
          goals?: string[];
          completed_at?: Timestamptz | null;
          version?: number;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['skin_profiles']['Insert']>;
        Relationships: [];
      };
      user_products: {
        Row: {
          id: string;
          user_id: string;
          catalog_product_id: string | null;
          manual_name: string | null;
          manual_brand: string | null;
          barcode: string | null;
          opened_at: DateStr | null;
          pao_months: number | null;
          expiry_date: DateStr | null;
          expiry_computed: DateStr | null;
          status: string;
          // Smart Shelf extensions (migration 0016, docs/04 §2).
          is_opened: boolean;
          finished_at: DateStr | null;
          nickname: string | null;
          notes: string | null;
          thumbnail_path: string | null;
          pao_source: string | null;
          expiry_source: string | null;
          added_via: string | null;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          catalog_product_id?: string | null;
          manual_name?: string | null;
          manual_brand?: string | null;
          barcode?: string | null;
          opened_at?: DateStr | null;
          pao_months?: number | null;
          expiry_date?: DateStr | null;
          // expiry_computed is GENERATED — never inserted.
          status?: string;
          is_opened?: boolean;
          finished_at?: DateStr | null;
          nickname?: string | null;
          notes?: string | null;
          thumbnail_path?: string | null;
          pao_source?: string | null;
          expiry_source?: string | null;
          added_via?: string | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['user_products']['Insert']>;
        Relationships: [];
      };
      shelf_scans: {
        Row: {
          id: string;
          user_id: string;
          barcode: string | null;
          matched_product_id: string | null;
          result: string;
          contributed_back: boolean;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          barcode?: string | null;
          matched_product_id?: string | null;
          result: string;
          contributed_back?: boolean;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['shelf_scans']['Insert']>;
        Relationships: [];
      };
      routines: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          name: string | null;
          is_active: boolean;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          name?: string | null;
          is_active?: boolean;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['routines']['Insert']>;
        Relationships: [];
      };
      routine_steps: {
        Row: {
          id: string;
          routine_id: string;
          user_product_id: string | null;
          step_order: number;
          frequency: string;
          cycling_night: number | null;
          instructions: string | null;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          routine_id: string;
          user_product_id?: string | null;
          step_order: number;
          frequency?: string;
          cycling_night?: number | null;
          instructions?: string | null;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['routine_steps']['Insert']>;
        Relationships: [];
      };
      routine_completions: {
        Row: {
          id: string;
          user_id: string;
          routine_id: string;
          step_id: string | null;
          completed_at: Timestamptz;
          completed_date: DateStr;
          source: string;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          routine_id: string;
          step_id?: string | null;
          completed_at?: Timestamptz;
          completed_date: DateStr;
          // source is set server-side by the validate_completion trigger.
          source?: string;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['routine_completions']['Insert']>;
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          user_id: string;
          storage_path: string | null;
          taken_at: Timestamptz;
          lighting_score: number | null;
          alignment_score: number | null;
          local_only: boolean;
          face_region_redacted: boolean;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          storage_path?: string | null;
          taken_at?: Timestamptz;
          lighting_score?: number | null;
          alignment_score?: number | null;
          local_only?: boolean;
          face_region_redacted?: boolean;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['photos']['Insert']>;
        Relationships: [];
      };
      entitlements: {
        Row: {
          user_id: string;
          entitlement: string | null;
          is_active: boolean;
          product_id: string | null;
          expires_at: Timestamptz | null;
          rc_event_id: string | null;
          updated_at: Timestamptz;
        };
        Insert: {
          user_id: string;
          entitlement?: string | null;
          is_active?: boolean;
          product_id?: string | null;
          expires_at?: Timestamptz | null;
          rc_event_id?: string | null;
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['entitlements']['Insert']>;
        Relationships: [];
      };
      subscriptions_events: {
        Row: {
          id: string;
          rc_event_id: string | null;
          user_id: string | null;
          event_type: string | null;
          payload: Json | null;
          received_at: Timestamptz;
        };
        Insert: {
          id?: string;
          rc_event_id?: string | null;
          user_id?: string | null;
          event_type?: string | null;
          payload?: Json | null;
          received_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['subscriptions_events']['Insert']>;
        Relationships: [];
      };
      consents: {
        Row: {
          id: string;
          user_id: string;
          consent_type: string;
          granted: boolean;
          version: string;
          consent_text_hash: string | null;
          granted_at: Timestamptz;
          revoked_at: Timestamptz | null;
          ip: string | null;
          user_agent: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          consent_type: string;
          granted: boolean;
          version: string;
          consent_text_hash?: string | null;
          granted_at?: Timestamptz;
          revoked_at?: Timestamptz | null;
          ip?: string | null;
          user_agent?: string | null;
        };
        Update: Partial<Database['public']['Tables']['consents']['Insert']>;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          am_reminder_time: TimeStr | null;
          pm_reminder_time: TimeStr | null;
          streak_nudges: boolean;
          replenishment_alerts: boolean;
          push_token: string | null;
          timezone: string | null;
          updated_at: Timestamptz;
        };
        Insert: {
          user_id: string;
          am_reminder_time?: TimeStr | null;
          pm_reminder_time?: TimeStr | null;
          streak_nudges?: boolean;
          replenishment_alerts?: boolean;
          push_token?: string | null;
          timezone?: string | null;
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['notification_preferences']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      owns_routine: {
        Args: { p_routine_id: string };
        Returns: boolean;
      };
      recompute_streak: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
