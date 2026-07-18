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
      shelf_mirror_versions: {
        Row: {
          user_id: string;
          entity_id: string;
          client_revision: number;
          tombstone: boolean;
          last_operation_id: string | null;
          updated_at: Timestamptz;
        };
        Insert: {
          user_id: string;
          entity_id: string;
          client_revision?: number;
          tombstone?: boolean;
          last_operation_id?: string | null;
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['shelf_mirror_versions']['Insert']>;
        Relationships: [];
      };
      mobile_outbox_receipts: {
        Row: {
          user_id: string;
          operation_id: string;
          idempotency_key: string;
          entity_type:
            | 'notification_delivery'
            | 'notification_preferences'
            | 'recommendation_preferences'
            | 'shelf_scan'
            | 'shelf_product';
          entity_id: string;
          operation_kind: 'delete' | 'upsert';
          client_revision: number;
          result_status: 'applied' | 'stale';
          payload_hash: string | null;
          applied_at: Timestamptz;
        };
        Insert: {
          user_id: string;
          operation_id: string;
          idempotency_key: string;
          entity_type:
            | 'notification_delivery'
            | 'notification_preferences'
            | 'recommendation_preferences'
            | 'shelf_scan'
            | 'shelf_product';
          entity_id: string;
          operation_kind: 'delete' | 'upsert';
          client_revision: number;
          result_status: 'applied' | 'stale';
          payload_hash?: string | null;
          applied_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['mobile_outbox_receipts']['Insert']>;
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
        Insert: {
          user_id: string;
          values_filters?: string[];
          budget_band?: string | null;
          format_prefs?: string[];
          updated_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['recommendation_preferences']['Insert']>;
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
        Insert: {
          id?: string;
          user_id: string;
          trigger: string;
          product_type: string;
          catalog_product_id?: string | null;
          fit_rationale: string;
          evidence_grade?: string | null;
          status?: string;
          created_at?: Timestamptz;
        };
        Update: Partial<Database['public']['Tables']['recommendations']['Insert']>;
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
      apply_notification_preferences_outbox_batch: {
        Args: { p_operations: Json };
        Returns: Json;
      };
      apply_notification_delivery_outbox_batch: {
        Args: { p_operations: Json };
        Returns: Json;
      };
      apply_recommendation_preferences_outbox_batch: {
        Args: { p_operations: Json };
        Returns: Json;
      };
      apply_shelf_scan_outbox_batch: {
        Args: { p_operations: Json };
        Returns: Json;
      };
      apply_shelf_outbox_batch: {
        Args: { p_operations: Json };
        Returns: Json;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
