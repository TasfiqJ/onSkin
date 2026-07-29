/**
 * Supabase `Database` type.
 *
 * BLOCKED: B-SUPABASE. Once the project exists, REGENERATE from the live schema:
 *   supabase gen types typescript --project-id <ref> > packages/types/src/database.types.ts
 *
 * Until then this is hand-authored to exactly match `supabase/migrations/`
 * (0001-0016) so the client is fully typed during development. Keep in sync with
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
          adherence_timezone: string | null;
          streak_reference_day: DateStr | null;
          streak_algorithm_version: number;
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
          adherence_timezone?: string | null;
          streak_reference_day?: DateStr | null;
          streak_algorithm_version?: number;
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
          dspt: string | null;
          oily_dry_basis_points: number | null;
          sensitive_resistant_basis_points: number | null;
          pigmented_non_basis_points: number | null;
          wrinkled_tight_basis_points: number | null;
          quiz_contract_id: string | null;
          quiz_content_version: string | null;
          quiz_scoring_version: string | null;
          quiz_output_schema_version: number | null;
          quiz_content_sha256: string | null;
          quiz_scoring_sha256: string | null;
          quiz_contract_sha256: string | null;
          quiz_review_status: string | null;
          quiz_pole_tie_rule: string | null;
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
          dspt?: string | null;
          oily_dry_basis_points?: number | null;
          sensitive_resistant_basis_points?: number | null;
          pigmented_non_basis_points?: number | null;
          wrinkled_tight_basis_points?: number | null;
          quiz_contract_id?: string | null;
          quiz_content_version?: string | null;
          quiz_scoring_version?: string | null;
          quiz_output_schema_version?: number | null;
          quiz_content_sha256?: string | null;
          quiz_scoring_sha256?: string | null;
          quiz_contract_sha256?: string | null;
          quiz_review_status?: string | null;
          quiz_pole_tie_rule?: string | null;
        };
        Update: Partial<Database['public']['Tables']['skin_profiles']['Insert']>;
        Relationships: [];
      };
      user_products: {
        Row: {
          id: string;
          user_id: string;
          catalog_product_id: string | null;
          catalog_source_id: string | null;
          catalog_match_quality: string | null;
          catalog_source_snapshot_date: DateStr | null;
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
          discard_after: DateStr | null;
          discard_basis: string | null;
          routine_slot: string | null;
          source_disclosure_ack_at: Timestamptz | null;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          catalog_product_id?: string | null;
          catalog_source_id?: string | null;
          catalog_match_quality?: string | null;
          catalog_source_snapshot_date?: DateStr | null;
          manual_name?: string | null;
          manual_brand?: string | null;
          barcode?: string | null;
          opened_at?: DateStr | null;
          pao_months?: number | null;
          expiry_date?: DateStr | null;
          // expiry_computed is GENERATED. Never inserted.
          status?: string;
          is_opened?: boolean;
          finished_at?: DateStr | null;
          nickname?: string | null;
          notes?: string | null;
          thumbnail_path?: string | null;
          pao_source?: string | null;
          expiry_source?: string | null;
          added_via?: string | null;
          discard_after?: DateStr | null;
          discard_basis?: string | null;
          routine_slot?: string | null;
          source_disclosure_ack_at?: Timestamptz | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['user_products']['Insert']>;
        Relationships: [];
      };
      shelf_product_identities: {
        Row: {
          id: string;
          user_id: string;
          created_at: Timestamptz;
          deleted_effective_at: Timestamptz | null;
          deleted_received_at: Timestamptz | null;
        };
        Insert: {
          id: string;
          user_id: string;
          created_at?: Timestamptz;
          deleted_effective_at?: Timestamptz | null;
          deleted_received_at?: Timestamptz | null;
        };
        Update: Partial<Database['public']['Tables']['shelf_product_identities']['Insert']>;
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
      cycles: {
        Row: {
          id: string;
          user_id: string;
          variant: string;
          length_nights: number;
          anchor_date: DateStr;
          is_active: boolean;
          paused_from: DateStr | null;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          variant?: string;
          length_nights?: number;
          anchor_date: DateStr;
          is_active?: boolean;
          paused_from?: DateStr | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['cycles']['Insert']>;
        Relationships: [];
      };
      cycle_nights: {
        Row: {
          cycle_id: string;
          night_index: number;
          slot: string;
          user_product_id: string | null;
        };
        Insert: {
          cycle_id: string;
          night_index: number;
          slot: string;
          user_product_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['cycle_nights']['Insert']>;
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
        // Guided photo-progress (docs/06 §6). Image bytes live on-device
        // (local_uri) unless cloud-opted; head_* are coarse pose QA, NOT a faceprint.
        Row: {
          id: string;
          user_id: string;
          storage_path: string | null;
          taken_at: Timestamptz;
          lighting_score: number | null;
          alignment_score: number | null;
          local_only: boolean;
          face_region_redacted: boolean;
          reference_photo_id: string | null;
          series: string;
          capture_session_id: string | null;
          head_roll: number | null;
          head_yaw: number | null;
          head_pitch: number | null;
          quality_source: string | null;
          taken_local_date: string;
          time_of_day: string | null;
          notes: string | null;
          local_uri: string | null;
          is_encrypted: boolean;
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
          reference_photo_id?: string | null;
          series?: string;
          capture_session_id?: string | null;
          head_roll?: number | null;
          head_yaw?: number | null;
          head_pitch?: number | null;
          quality_source?: string | null;
          taken_local_date?: string;
          time_of_day?: string | null;
          notes?: string | null;
          local_uri?: string | null;
          is_encrypted?: boolean;
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
          store: string | null;
          period_type: string | null;
          will_renew: boolean | null;
          original_purchase_at: Timestamptz | null;
          offering_id: string | null;
          experiment_id: string | null;
          acquisition_channel: string | null;
          source: string | null;
          environment: string | null;
          management_url: string | null;
          verified_at: Timestamptz | null;
          package_id: string | null;
          store_user_id: string | null;
          last_reconciled_at: Timestamptz | null;
          raw_status: Json;
          rc_event_at: Timestamptz | null;
          rc_event_priority: number | null;
          rc_original_transaction_id: string | null;
          rc_transaction_id: string | null;
          rc_cursor_state: 'ordered' | 'snapshot' | 'legacy_unknown';
          rc_snapshot_at: Timestamptz | null;
          rc_snapshot_fingerprint: string | null;
        };
        Insert: {
          user_id: string;
          entitlement?: string | null;
          is_active?: boolean;
          product_id?: string | null;
          expires_at?: Timestamptz | null;
          rc_event_id?: string | null;
          updated_at?: Timestamptz;
          store?: string | null;
          period_type?: string | null;
          will_renew?: boolean | null;
          original_purchase_at?: Timestamptz | null;
          offering_id?: string | null;
          experiment_id?: string | null;
          acquisition_channel?: string | null;
          source?: string | null;
          environment?: string | null;
          management_url?: string | null;
          verified_at?: Timestamptz | null;
          package_id?: string | null;
          store_user_id?: string | null;
          last_reconciled_at?: Timestamptz | null;
          raw_status?: Json;
          rc_event_at?: Timestamptz | null;
          rc_event_priority?: number | null;
          rc_original_transaction_id?: string | null;
          rc_transaction_id?: string | null;
          rc_cursor_state?: 'ordered' | 'snapshot' | 'legacy_unknown';
          rc_snapshot_at?: Timestamptz | null;
          rc_snapshot_fingerprint?: string | null;
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
          app_user_id: string | null;
          original_app_user_id: string | null;
          aliases: string[] | null;
          resolved_user_id: string | null;
          environment: string | null;
          store: string | null;
          product_id: string | null;
          processed_at: Timestamptz | null;
          processing_status: string | null;
          error: string | null;
          signature_verified: boolean | null;
          auth_verified: boolean | null;
          provider_event_at: Timestamptz | null;
          original_transaction_id: string | null;
          transaction_id: string | null;
          transferred_from: string[] | null;
          transferred_to: string[] | null;
          projection_priority: number | null;
          projection_applied: boolean;
          processing_attempts: number;
        };
        Insert: {
          id?: string;
          rc_event_id?: string | null;
          user_id?: string | null;
          event_type?: string | null;
          payload?: Json | null;
          received_at?: Timestamptz;
          app_user_id?: string | null;
          original_app_user_id?: string | null;
          aliases?: string[] | null;
          resolved_user_id?: string | null;
          environment?: string | null;
          store?: string | null;
          product_id?: string | null;
          processed_at?: Timestamptz | null;
          processing_status?: string | null;
          error?: string | null;
          signature_verified?: boolean | null;
          auth_verified?: boolean | null;
          provider_event_at?: Timestamptz | null;
          original_transaction_id?: string | null;
          transaction_id?: string | null;
          transferred_from?: string[] | null;
          transferred_to?: string[] | null;
          projection_priority?: number | null;
          projection_applied?: boolean;
          processing_attempts?: number;
        };
        Update: Partial<Database['public']['Tables']['subscriptions_events']['Insert']>;
        Relationships: [];
      };
      reverse_trial_grants: {
        Row: {
          user_id: string;
          granted_at: Timestamptz;
          expires_at: Timestamptz;
          source: string;
          metadata: Json;
        };
        Insert: {
          user_id: string;
          granted_at?: Timestamptz;
          expires_at: Timestamptz;
          source?: string;
          metadata?: Json;
        };
        Update: Partial<Database['public']['Tables']['reverse_trial_grants']['Insert']>;
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
      // Sealed server-owned registry. API roles have no direct table grants;
      // lifecycle RPCs validate exact disclosure copy against these rows.
      health_consent_copy_registry: {
        Row: {
          consent_type: string;
          action: string;
          version: string;
          consent_text_hash: string;
          review_status: string;
          is_current: boolean;
          created_at: Timestamptz;
        };
        Insert: {
          consent_type: string;
          action: string;
          version: string;
          consent_text_hash: string;
          review_status: string;
          is_current?: boolean;
          created_at?: Timestamptz;
        };
        Update: Partial<
          Database['public']['Tables']['health_consent_copy_registry']['Insert']
        >;
        Relationships: [];
      };
      health_consent_copy_review_events: {
        Row: {
          id: string;
          event_type: string;
          consent_type: string;
          action: string;
          version: string;
          consent_text_hash: string;
          from_status: string;
          to_status: string;
          from_is_current: boolean;
          to_is_current: boolean;
          successor_version: string | null;
          successor_consent_text_hash: string | null;
          successor_review_status: string | null;
          successor_is_current: boolean | null;
          review_ticket: string;
          reviewed_by: string;
          review_evidence_hash: string;
          lifecycle_xid: string;
          lifecycle_backend_pid: number;
          reviewed_at: Timestamptz;
        };
        Insert: {
          id?: string;
          event_type: string;
          consent_type: string;
          action: string;
          version: string;
          consent_text_hash: string;
          from_status: string;
          to_status: string;
          from_is_current: boolean;
          to_is_current: boolean;
          successor_version?: string | null;
          successor_consent_text_hash?: string | null;
          successor_review_status?: string | null;
          successor_is_current?: boolean | null;
          review_ticket: string;
          reviewed_by: string;
          review_evidence_hash: string;
          lifecycle_xid: string;
          lifecycle_backend_pid: number;
          reviewed_at?: Timestamptz;
        };
        Update: Partial<
          Database['public']['Tables']['health_consent_copy_review_events']['Insert']
        >;
        Relationships: [];
      };
      // Sealed migration-only evidence for draft-to-draft copy alignment.
      // This relation is distinct from legal/privacy review and release events.
      health_consent_copy_staging_events: {
        Row: {
          id: string;
          consent_type: string;
          action: string;
          previous_version: string;
          previous_consent_text_hash: string;
          previous_review_status: string;
          previous_from_is_current: boolean;
          previous_to_is_current: boolean;
          successor_version: string;
          successor_consent_text_hash: string;
          successor_review_status: string;
          successor_from_is_current: boolean;
          successor_to_is_current: boolean;
          staging_change_reference: string;
          staged_by: string;
          staging_evidence_hash: string;
          lifecycle_xid: string;
          lifecycle_backend_pid: number;
          staged_at: Timestamptz;
        };
        Insert: {
          id?: string;
          consent_type: string;
          action: string;
          previous_version: string;
          previous_consent_text_hash: string;
          previous_review_status: string;
          previous_from_is_current: boolean;
          previous_to_is_current: boolean;
          successor_version: string;
          successor_consent_text_hash: string;
          successor_review_status: string;
          successor_from_is_current: boolean;
          successor_to_is_current: boolean;
          staging_change_reference: string;
          staged_by: string;
          staging_evidence_hash: string;
          lifecycle_xid: string;
          lifecycle_backend_pid: number;
          staged_at?: Timestamptz;
        };
        Update: Partial<
          Database['public']['Tables']['health_consent_copy_staging_events']['Insert']
        >;
        Relationships: [];
      };
      // Sealed, durable idempotency and worker-recovery journal for each
      // purpose-specific consent grant or withdrawal.
      health_dependent_consent_operations: {
        Row: {
          id: string;
          user_id: string;
          consent_type: string;
          action: string;
          idempotency_digest: string;
          expected_processing_epoch: number;
          expected_generation: number;
          consent_generation: number;
          version: string;
          consent_text_hash: string;
          receipt_id: string | null;
          state: string;
          attempt_count: number;
          last_result_code: string | null;
          next_attempt_at: Timestamptz;
          worker_claim_digest: string | null;
          worker_lease_expires_at: Timestamptz | null;
          requested_at: Timestamptz;
          completed_at: Timestamptz | null;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          consent_type: string;
          action: string;
          idempotency_digest: string;
          expected_processing_epoch: number;
          expected_generation: number;
          consent_generation: number;
          version: string;
          consent_text_hash: string;
          receipt_id?: string | null;
          state?: string;
          attempt_count?: number;
          last_result_code?: string | null;
          next_attempt_at?: Timestamptz;
          worker_claim_digest?: string | null;
          worker_lease_expires_at?: Timestamptz | null;
          requested_at?: Timestamptz;
          completed_at?: Timestamptz | null;
          updated_at?: Timestamptz;
        };
        Update: Partial<
          Database['public']['Tables']['health_dependent_consent_operations']['Insert']
        >;
        Relationships: [];
      };
      // Sealed generation/CAS projection for each protected dependent purpose.
      health_dependent_consent_states: {
        Row: {
          user_id: string;
          consent_type: string;
          state: string;
          generation: number;
          health_epoch: number | null;
          current_receipt_id: string | null;
          current_operation_id: string | null;
          base_withdrawal_operation_id: string | null;
          parent_withdrawal_operation_id: string | null;
          version: string | null;
          consent_text_hash: string | null;
          withdrawal_requested_at: Timestamptz | null;
          withdrawal_completed_at: Timestamptz | null;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          user_id: string;
          consent_type: string;
          state?: string;
          generation?: number;
          health_epoch?: number | null;
          current_receipt_id?: string | null;
          current_operation_id?: string | null;
          base_withdrawal_operation_id?: string | null;
          parent_withdrawal_operation_id?: string | null;
          version?: string | null;
          consent_text_hash?: string | null;
          withdrawal_requested_at?: Timestamptz | null;
          withdrawal_completed_at?: Timestamptz | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: Partial<
          Database['public']['Tables']['health_dependent_consent_states']['Insert']
        >;
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
          am_reminder_enabled: boolean;
          pm_reminder_enabled: boolean;
          capture_reminders: boolean;
          quiet_hours_start: TimeStr | null;
          quiet_hours_end: TimeStr | null;
          live_activity_enabled: boolean;
          promotional_opt_in: boolean;
          lockscreen_discreet: boolean;
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
          am_reminder_enabled?: boolean;
          pm_reminder_enabled?: boolean;
          capture_reminders?: boolean;
          quiet_hours_start?: TimeStr | null;
          quiet_hours_end?: TimeStr | null;
          live_activity_enabled?: boolean;
          promotional_opt_in?: boolean;
          lockscreen_discreet?: boolean;
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['notification_preferences']['Insert']>;
        Relationships: [];
      };
      streak_freezes: {
        Row: {
          id: string;
          user_id: string;
          applied_for_date: string;
          source: string;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          applied_for_date: string;
          source?: string;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['streak_freezes']['Insert']>;
        Relationships: [];
      };
      notification_log: {
        Row: {
          id: string;
          user_id: string;
          tier: string;
          kind: string;
          sent_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier: string;
          kind: string;
          sent_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['notification_log']['Insert']>;
        Relationships: [];
      };
      recommendation_preferences: {
        Row: {
          user_id: string;
          values_filters: string[];
          budget_band: string | null;
          format_prefs: string[];
          updated_at: Timestamptz;
        };
        // CORE-06A: client table DML is closed. Authenticated owners write only
        // through set_recommendation_preferences.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // docs/09 §9. The recommendations cache. NO commercial column exists in the
      // ranking path (church and state, D-054); commerce metadata lives in doc #10.
      recommendations: {
        Row: {
          id: string;
          user_id: string;
          trigger: string;
          product_type: string;
          catalog_product_id: string | null;
          fit_rationale: string;
          evidence_grade: string | null;
          status: string;
          created_at: Timestamptz;
        };
        // CORE-06A: the optional cache is server-owned and admission is closed.
        // Catalog references are constrained NULL until a later reviewed release.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      // docs/10. The commerce domain, walled off downstream of ranking (D-058). No
      // commission/rate column is client-readable; order_attributions is service-role only.
      affiliate_links: {
        Row: {
          id: string;
          product_type: string;
          catalog_product_id: string | null;
          retailer: string;
          label: string;
          url: string;
          price_cents: number | null;
          currency: string | null;
          source: string;
          is_paid: boolean;
          is_active: boolean;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          product_type: string;
          catalog_product_id?: string | null;
          retailer: string;
          label: string;
          url: string;
          price_cents?: number | null;
          currency?: string | null;
          source?: string;
          is_paid?: boolean;
          is_active?: boolean;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['affiliate_links']['Insert']>;
        Relationships: [];
      };
      creator_stacks: {
        Row: {
          id: string;
          slug: string;
          title: string;
          subtitle: string | null;
          curator: string;
          curator_kind: string;
          reviewed_by: string | null;
          is_active: boolean;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          subtitle?: string | null;
          curator: string;
          curator_kind?: string;
          reviewed_by?: string | null;
          is_active?: boolean;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['creator_stacks']['Insert']>;
        Relationships: [];
      };
      creator_stack_items: {
        Row: {
          id: string;
          stack_id: string;
          position: number;
          product_type: string;
          catalog_product_id: string | null;
          role_label: string;
          note: string | null;
        };
        Insert: {
          id?: string;
          stack_id: string;
          position: number;
          product_type: string;
          catalog_product_id?: string | null;
          role_label: string;
          note?: string | null;
        };
        Update: Partial<Database['public']['Tables']['creator_stack_items']['Insert']>;
        Relationships: [];
      };
      commerce_click_events: {
        Row: {
          id: string;
          user_id: string;
          click_token: string;
          health_processing_epoch: number;
          data_sharing_generation: number;
          product_type: string | null;
          affiliate_link_id: string | null;
          source: string;
          consented: boolean;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          click_token: string;
          health_processing_epoch?: number;
          data_sharing_generation?: number;
          product_type?: string | null;
          affiliate_link_id?: string | null;
          source?: string;
          consented?: boolean;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['commerce_click_events']['Insert']>;
        Relationships: [];
      };
      // Service-role only (no client policies). Commission/order data, the row-level
      // church-and-state wall (docs/10 §9).
      order_attributions: {
        Row: {
          id: string;
          external_order_id: string;
          click_token: string | null;
          order_amount_cents: number | null;
          commission_cents: number | null;
          currency: string | null;
          status: string;
          transaction_date: Timestamptz | null;
          record_updated_at: Timestamptz | null;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          external_order_id: string;
          click_token?: string | null;
          order_amount_cents?: number | null;
          commission_cents?: number | null;
          currency?: string | null;
          status?: string;
          transaction_date?: Timestamptz | null;
          record_updated_at?: Timestamptz | null;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['order_attributions']['Insert']>;
        Relationships: [];
      };
      // docs/11. The community layer. PHOTO-FREE by design (D-064); no commission
      // field (church and state, D-063); consent-scoped + anon-locked-out (D-066).
      community_topics: {
        Row: { id: string; slug: string; title: string; description: string | null; sort_order: number; is_active: boolean };
        Insert: { id?: string; slug: string; title: string; description?: string | null; sort_order?: number; is_active?: boolean };
        Update: Partial<Database['public']['Tables']['community_topics']['Insert']>;
        Relationships: [];
      };
      community_notes: {
        Row: {
          id: string;
          topic_id: string;
          kind: string;
          title: string;
          body: string;
          evidence_grade: string | null;
          evidence_label: string | null;
          provenance: string;
          author_credential: string | null;
          source_url: string | null;
          claim_safety_ok: boolean;
          reviewed_by: string | null;
          created_at: Timestamptz;
          updated_at: Timestamptz;
        };
        Insert: {
          id?: string;
          topic_id: string;
          kind: string;
          title: string;
          body: string;
          evidence_grade?: string | null;
          evidence_label?: string | null;
          provenance?: string;
          author_credential?: string | null;
          source_url?: string | null;
          claim_safety_ok?: boolean;
          reviewed_by?: string | null;
          created_at?: Timestamptz;
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['community_notes']['Insert']>;
        Relationships: [];
      };
      community_questions: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string;
          body: string;
          anon_handle: string;
          moderation_state: string;
          claim_safety_flag: boolean | null;
          rejected_reason: string | null;
          consent_grant_id: string;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          body: string;
          anon_handle: string;
          moderation_state?: string;
          claim_safety_flag?: boolean | null;
          rejected_reason?: string | null;
          consent_grant_id: string;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['community_questions']['Insert']>;
        Relationships: [];
      };
      community_reactions: {
        Row: { id: string; user_id: string; note_id: string | null; reaction: string; created_at: Timestamptz };
        Insert: { id?: string; user_id: string; note_id?: string | null; reaction: string; created_at?: Timestamptz };
        Update: Partial<Database['public']['Tables']['community_reactions']['Insert']>;
        Relationships: [];
      };
      community_moderation_events: {
        Row: { id: string; question_id: string | null; action: string; reason: string | null; acted_at: Timestamptz };
        Insert: { id?: string; question_id?: string | null; action: string; reason?: string | null; acted_at?: Timestamptz };
        Update: Partial<Database['public']['Tables']['community_moderation_events']['Insert']>;
        Relationships: [];
      };
      community_reports: {
        Row: { id: string; reporter_id: string; question_id: string; reason: string; created_at: Timestamptz; resolved_at: Timestamptz | null };
        Insert: { id?: string; reporter_id: string; question_id: string; reason: string; created_at?: Timestamptz; resolved_at?: Timestamptz | null };
        Update: Partial<Database['public']['Tables']['community_reports']['Insert']>;
        Relationships: [];
      };
      community_blocks: {
        Row: { user_id: string; blocked_handle: string; created_at: Timestamptz };
        Insert: { user_id: string; blocked_handle: string; created_at?: Timestamptz };
        Update: Partial<Database['public']['Tables']['community_blocks']['Insert']>;
        Relationships: [];
      };
      // docs/12. On-device within-person trend state. NO score/grade/image column
      // (D-068/D-070); the source image stays local_only (docs/06).
      photo_trend: {
        Row: {
          id: string;
          user_id: string;
          series: string;
          capture_session_id: string | null;
          delta_metric: number | null;
          mdc_threshold: number | null;
          change_state: string;
          narrative_key: string | null;
          monk_tone_band: number | null;
          computed_local_date: string;
          created_at: Timestamptz;
        };
        Insert: {
          id?: string;
          user_id: string;
          series: string;
          capture_session_id?: string | null;
          delta_metric?: number | null;
          mdc_threshold?: number | null;
          change_state: string;
          narrative_key?: string | null;
          monk_tone_band?: number | null;
          computed_local_date: string;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['photo_trend']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      set_recommendation_preferences: {
        Args: {
          p_values_filters: string[];
          p_budget_band: string | null;
          p_format_prefs: string[];
        };
        Returns: {
          user_id: string;
          values_filters: string[];
          budget_band: string | null;
          format_prefs: string[];
          updated_at: Timestamptz;
        }[];
      };
      stage_health_consent_copy_draft_successor: {
        Args: {
          p_consent_type: string;
          p_action: string;
          p_previous_version: string;
          p_previous_consent_text_hash: string;
          p_successor_version: string;
          p_successor_consent_text_hash: string;
          p_staging_change_reference: string;
          p_staged_by: string;
          p_staging_evidence_hash: string;
        };
        Returns: {
          staging_event_id: string;
          consent_type: string;
          action: string;
          previous_version: string;
          previous_consent_text_hash: string;
          successor_version: string;
          successor_consent_text_hash: string;
          successor_review_status: string;
          successor_is_current: boolean;
          staging_change_reference: string;
          staged_by: string;
          staging_evidence_hash: string;
          staged_at: Timestamptz;
        }[];
      };
      promote_health_consent_copy_for_release: {
        Args: {
          p_consent_type: string;
          p_action: string;
          p_version: string;
          p_consent_text_hash: string;
          p_review_ticket: string;
          p_reviewed_by: string;
          p_review_evidence_hash: string;
        };
        Returns: {
          review_event_id: string;
          consent_type: string;
          action: string;
          version: string;
          consent_text_hash: string;
          review_status: string;
          review_ticket: string;
          reviewed_by: string;
          review_evidence_hash: string;
          reviewed_at: Timestamptz;
        }[];
      };
      supersede_health_consent_copy_for_release: {
        Args: {
          p_consent_type: string;
          p_action: string;
          p_previous_version: string;
          p_previous_consent_text_hash: string;
          p_successor_version: string;
          p_successor_consent_text_hash: string;
          p_review_ticket: string;
          p_reviewed_by: string;
          p_review_evidence_hash: string;
        };
        Returns: {
          lifecycle_event_id: string;
          consent_type: string;
          action: string;
          previous_version: string;
          previous_consent_text_hash: string;
          successor_version: string;
          successor_consent_text_hash: string;
          successor_review_status: string;
          successor_is_current: boolean;
          review_ticket: string;
          reviewed_by: string;
          review_evidence_hash: string;
          reviewed_at: Timestamptz;
        }[];
      };
      close_health_consent_copy_for_emergency: {
        Args: {
          p_consent_type: string;
          p_action: string;
          p_version: string;
          p_consent_text_hash: string;
          p_review_ticket: string;
          p_reviewed_by: string;
          p_review_evidence_hash: string;
        };
        Returns: {
          lifecycle_event_id: string;
          consent_type: string;
          action: string;
          version: string;
          consent_text_hash: string;
          review_status: string;
          is_current: boolean;
          review_ticket: string;
          reviewed_by: string;
          review_evidence_hash: string;
          reviewed_at: Timestamptz;
        }[];
      };
      defer_health_consent_withdrawal: {
        Args: {
          p_operation_id: string;
          p_claim_token: string;
          p_result_code: string;
          p_retry_after_seconds: number;
        };
        Returns: {
          operation_id: string;
          operation_state: string;
          result_code: string;
          next_attempt_at: Timestamptz;
        }[];
      };
      get_health_dependent_consent_status: {
        Args: { p_consent_type: string };
        Returns: {
          consent_type: string;
          state: string;
          generation: number;
          health_epoch: number | null;
          version: string | null;
          consent_text_hash: string | null;
        }[];
      };
      record_health_dependent_consent: {
        Args: {
          p_expected_epoch: number;
          p_expected_generation: number;
          p_idempotency_key: string;
          p_consent_type: string;
          p_version: string;
          p_consent_text_hash: string;
        };
        Returns: {
          consent_type: string;
          state: string;
          generation: number;
          health_epoch: number;
          version: string | null;
          consent_text_hash: string | null;
        }[];
      };
      begin_health_dependent_consent_withdrawal: {
        Args: {
          p_expected_epoch: number;
          p_expected_generation: number;
          p_consent_type: string;
          p_idempotency_key: string;
          p_version: string;
          p_consent_text_hash: string;
        };
        Returns: {
          operation_id: string;
          user_id: string;
          consent_type: string;
          state: string;
          processing_epoch: number;
          consent_generation: number;
        }[];
      };
      complete_health_dependent_consent_withdrawal: {
        Args: { p_operation_id: string };
        Returns: {
          operation_id: string;
          user_id: string;
          consent_type: string;
          state: string;
          processing_epoch: number;
          consent_generation: number;
        }[];
      };
      claim_due_health_dependent_consent_withdrawals: {
        Args: { p_claim_token: string; p_limit?: number };
        Returns: {
          operation_id: string;
          user_id: string;
          consent_type: string;
          processing_epoch: number;
          consent_generation: number;
        }[];
      };
      list_health_dependent_consent_storage_work: {
        Args: {
          p_operation_id: string;
          p_limit: number;
          p_claim_token: string;
        };
        Returns: { storage_path: string }[];
      };
      defer_health_dependent_consent_withdrawal: {
        Args: {
          p_operation_id: string;
          p_claim_token: string;
          p_result_code: string;
          p_retry_after_seconds?: number;
        };
        Returns: {
          operation_id: string;
          state: string;
          result_code: string;
          next_attempt_at: Timestamptz;
        }[];
      };
      mark_health_dependent_consent_withdrawal_action_required: {
        Args: {
          p_operation_id: string;
          p_claim_token: string;
          p_result_code: string;
        };
        Returns: {
          operation_id: string;
          state: string;
          result_code: string;
        }[];
      };
      owns_routine: {
        Args: { p_routine_id: string };
        Returns: boolean;
      };
      owns_cycle: {
        Args: { p_cycle_id: string };
        Returns: boolean;
      };
      owns_consent: {
        Args: { p_consent_id: string };
        Returns: boolean;
      };
      recompute_streak: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      set_routine_adherence_timezone: {
        Args: { p_timezone: string };
        Returns: {
          current_streak: number;
          longest_streak: number;
          adherence_timezone: string;
          reference_day: DateStr;
          frozen_dates: DateStr[];
          lapsed: boolean;
          algorithm_version: number;
        }[];
      };
      refresh_routine_adherence: {
        Args: Record<string, never>;
        Returns: {
          current_streak: number;
          longest_streak: number;
          adherence_timezone: string;
          reference_day: DateStr;
          frozen_dates: DateStr[];
          lapsed: boolean;
          algorithm_version: number;
        }[];
      };
      export_shelf_product_identities_for_subject: {
        Args: {
          p_after_created_at: Timestamptz | null;
          p_after_id: string | null;
          p_limit: number;
        };
        Returns: {
          export_total_count: number;
          id: string;
          user_id: string;
          created_at: Timestamptz;
          deleted_effective_at: Timestamptz | null;
          deleted_received_at: Timestamptz | null;
        }[];
      };
      export_shelf_sync_receipts_for_subject: {
        Args: {
          p_after_created_at: Timestamptz | null;
          p_after_id: string | null;
          p_limit: number;
        };
        Returns: {
          export_total_count: number;
          operation_id: string;
          user_id: string;
          state: string;
          result_code: string | null;
          created_at: Timestamptz;
          finalized_at: Timestamptz | null;
        }[];
      };
      export_routine_completion_sync_receipts_for_subject: {
        Args: {
          p_after_created_at: Timestamptz | null;
          p_after_id: string | null;
          p_limit: number;
        };
        Returns: {
          export_total_count: number;
          event_id: string;
          user_id: string;
          state: string;
          result_code: string | null;
          created_at: Timestamptz;
          finalized_at: Timestamptz | null;
        }[];
      };
      sync_shelf_product: {
        Args: {
          p_operation_id: string;
          p_operation_kind: string;
          p_enqueued_at: string;
          p_product_id: string;
          p_payload: Json;
        };
        Returns: Json;
      };
      record_routine_completion: {
        Args: {
          p_event_id: string;
          p_routine_id: string;
          p_routine_type: string;
          p_step_id: string | null;
          p_user_product_id: string | null;
          p_step_order: number | null;
          p_completed_at: string;
          p_completed_date: string;
          p_timezone: string;
        };
        Returns: Json;
      };
      read_entitlement_projections: {
        Args: Record<string, never>;
        Returns: Json;
      };
      reconcile_revenuecat_entitlement_snapshot: {
        Args: {
          p_user_id: string;
          p_snapshot_at: Timestamptz;
          p_entitlement: string | null;
          p_is_active: boolean;
          p_product_id: string | null;
          p_expires_at: Timestamptz | null;
          p_store: string | null;
          p_period_type: string | null;
          p_will_renew: boolean | null;
          p_original_purchase_at: Timestamptz | null;
          p_offering_id: string | null;
          p_environment: string | null;
          p_management_url: string | null;
          p_package_id: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
