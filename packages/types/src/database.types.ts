export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      account_deletion_barriers: {
        Row: {
          created_at: string
          expires_at: string
          operation_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          operation_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          operation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_barriers_operation_id_user_id_fkey"
            columns: ["operation_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_deletion_operations"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      account_deletion_operations: {
        Row: {
          capability_digest: string
          created_at: string
          expires_at: string
          id: string
          idempotency_digest: string
          publication_drain_started_at: string | null
          publication_drained_at: string | null
          publication_settle_not_before: string | null
          revenuecat_absence_first_observed_at: string | null
          revenuecat_absence_last_claim_digest: string | null
          revenuecat_absence_observation_count: number
          revenuecat_absence_second_observed_at: string | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capability_digest: string
          created_at?: string
          expires_at: string
          id?: string
          idempotency_digest: string
          publication_drain_started_at?: string | null
          publication_drained_at?: string | null
          publication_settle_not_before?: string | null
          revenuecat_absence_first_observed_at?: string | null
          revenuecat_absence_last_claim_digest?: string | null
          revenuecat_absence_observation_count?: number
          revenuecat_absence_second_observed_at?: string | null
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capability_digest?: string
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_digest?: string
          publication_drain_started_at?: string | null
          publication_drained_at?: string | null
          publication_settle_not_before?: string | null
          revenuecat_absence_first_observed_at?: string | null
          revenuecat_absence_last_claim_digest?: string | null
          revenuecat_absence_observation_count?: number
          revenuecat_absence_second_observed_at?: string | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      account_deletion_operator_recovery_audit: {
        Row: {
          command_digest: string
          created_at: string
          expires_at: string
          operation_id: string
          prior_result_code: string | null
          reason_code: string
          recovery_mode: string
          step_name: string
        }
        Insert: {
          command_digest: string
          created_at: string
          expires_at: string
          operation_id: string
          prior_result_code?: string | null
          reason_code: string
          recovery_mode: string
          step_name: string
        }
        Update: {
          command_digest?: string
          created_at?: string
          expires_at?: string
          operation_id?: string
          prior_result_code?: string | null
          reason_code?: string
          recovery_mode?: string
          step_name?: string
        }
        Relationships: []
      }
      account_deletion_receipts: {
        Row: {
          apple_manual_revocation_required: boolean
          capability_digest: string
          completed_at: string
          expires_at: string
          purge_after: string
          receipt_state: string
          subject_hmac: string | null
          subject_hmac_key_version: number | null
        }
        Insert: {
          apple_manual_revocation_required: boolean
          capability_digest: string
          completed_at?: string
          expires_at: string
          purge_after: string
          receipt_state: string
          subject_hmac?: string | null
          subject_hmac_key_version?: number | null
        }
        Update: {
          apple_manual_revocation_required?: boolean
          capability_digest?: string
          completed_at?: string
          expires_at?: string
          purge_after?: string
          receipt_state?: string
          subject_hmac?: string | null
          subject_hmac_key_version?: number | null
        }
        Relationships: []
      }
      account_deletion_steps: {
        Row: {
          attempt_count: number
          claim_digest: string | null
          completed_at: string | null
          created_at: string
          encrypted_payload: string | null
          lease_expires_at: string | null
          lease_kind: string | null
          max_attempts: number
          next_attempt_at: string | null
          operation_id: string
          request_started_at: string | null
          result_code: string | null
          status: string
          step_name: string
          step_order: number
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          claim_digest?: string | null
          completed_at?: string | null
          created_at?: string
          encrypted_payload?: string | null
          lease_expires_at?: string | null
          lease_kind?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          operation_id: string
          request_started_at?: string | null
          result_code?: string | null
          status?: string
          step_name: string
          step_order: number
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          claim_digest?: string | null
          completed_at?: string | null
          created_at?: string
          encrypted_payload?: string | null
          lease_expires_at?: string | null
          lease_kind?: string | null
          max_attempts?: number
          next_attempt_at?: string | null
          operation_id?: string
          request_started_at?: string | null
          result_code?: string | null
          status?: string
          step_name?: string
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_steps_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "account_deletion_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      account_publication_leases: {
        Row: {
          activated_at: string | null
          capability_digest: string
          close_reason: string | null
          closed_at: string | null
          drain_operation_id: string | null
          drain_started_at: string | null
          expires_at: string
          renewed_at: string | null
          reserved_at: string
          state: string
          updated_at: string
          user_id: string
          verified_session_id: string
        }
        Insert: {
          activated_at?: string | null
          capability_digest: string
          close_reason?: string | null
          closed_at?: string | null
          drain_operation_id?: string | null
          drain_started_at?: string | null
          expires_at: string
          renewed_at?: string | null
          reserved_at: string
          state: string
          updated_at: string
          user_id: string
          verified_session_id: string
        }
        Update: {
          activated_at?: string | null
          capability_digest?: string
          close_reason?: string | null
          closed_at?: string | null
          drain_operation_id?: string | null
          drain_started_at?: string | null
          expires_at?: string
          renewed_at?: string | null
          reserved_at?: string
          state?: string
          updated_at?: string
          user_id?: string
          verified_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_publication_leases_drain_operation_id_user_id_fkey"
            columns: ["drain_operation_id", "user_id"]
            isOneToOne: false
            referencedRelation: "account_deletion_operations"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      active_ramp: {
        Row: {
          created_at: string
          freq_per_week: number
          id: string
          last_step_up: string | null
          next_review_at: string | null
          ramp_class: string
          started_at: string
          target_per_week: number
          tolerance_state: string
          updated_at: string
          user_id: string
          user_product_id: string
        }
        Insert: {
          created_at?: string
          freq_per_week: number
          id?: string
          last_step_up?: string | null
          next_review_at?: string | null
          ramp_class: string
          started_at?: string
          target_per_week: number
          tolerance_state?: string
          updated_at?: string
          user_id: string
          user_product_id: string
        }
        Update: {
          created_at?: string
          freq_per_week?: number
          id?: string
          last_step_up?: string | null
          next_review_at?: string | null
          ramp_class?: string
          started_at?: string
          target_per_week?: number
          tolerance_state?: string
          updated_at?: string
          user_id?: string
          user_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_ramp_user_product_id_fkey"
            columns: ["user_product_id"]
            isOneToOne: false
            referencedRelation: "user_products"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_links: {
        Row: {
          catalog_product_id: string | null
          created_at: string
          currency: string | null
          id: string
          is_active: boolean
          is_paid: boolean
          label: string
          price_cents: number | null
          product_type: string
          retailer: string
          source: string
          url: string
        }
        Insert: {
          catalog_product_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          label: string
          price_cents?: number | null
          product_type: string
          retailer: string
          source?: string
          url: string
        }
        Update: {
          catalog_product_id?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean
          label?: string
          price_cents?: number | null
          product_type?: string
          retailer?: string
          source?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      apple_auth_capture_operations: {
        Row: {
          apple_subject_hmac: string
          client_id: string
          code_hmac: string
          completed_at: string | null
          created_at: string
          exchange_started_at: string | null
          expires_at: string
          failure_code: string | null
          id: string
          session_id: string
          state: string
          subject_hmac_key_version: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apple_subject_hmac: string
          client_id: string
          code_hmac: string
          completed_at?: string | null
          created_at?: string
          exchange_started_at?: string | null
          expires_at?: string
          failure_code?: string | null
          id: string
          session_id: string
          state?: string
          subject_hmac_key_version: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apple_subject_hmac?: string
          client_id?: string
          code_hmac?: string
          completed_at?: string | null
          created_at?: string
          exchange_started_at?: string | null
          expires_at?: string
          failure_code?: string | null
          id?: string
          session_id?: string
          state?: string
          subject_hmac_key_version?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      apple_auth_lifecycles: {
        Row: {
          apple_subject_hmac: string
          client_id: string
          created_at: string
          encrypted_refresh_token: string | null
          generation: number
          last_event_at: string | null
          last_event_rank: number
          last_failure_code: string | null
          last_validated_at: string | null
          next_validation_at: string | null
          relay_email_hmac: string | null
          relay_email_state: string
          state: string
          subject_hmac_key_version: string
          updated_at: string
          user_id: string
          validation_attempt_count: number
          validation_claim_digest: string | null
          validation_lease_expires_at: string | null
          vault_key_version: string | null
        }
        Insert: {
          apple_subject_hmac: string
          client_id: string
          created_at?: string
          encrypted_refresh_token?: string | null
          generation?: number
          last_event_at?: string | null
          last_event_rank?: number
          last_failure_code?: string | null
          last_validated_at?: string | null
          next_validation_at?: string | null
          relay_email_hmac?: string | null
          relay_email_state?: string
          state: string
          subject_hmac_key_version: string
          updated_at?: string
          user_id: string
          validation_attempt_count?: number
          validation_claim_digest?: string | null
          validation_lease_expires_at?: string | null
          vault_key_version?: string | null
        }
        Update: {
          apple_subject_hmac?: string
          client_id?: string
          created_at?: string
          encrypted_refresh_token?: string | null
          generation?: number
          last_event_at?: string | null
          last_event_rank?: number
          last_failure_code?: string | null
          last_validated_at?: string | null
          next_validation_at?: string | null
          relay_email_hmac?: string | null
          relay_email_state?: string
          state?: string
          subject_hmac_key_version?: string
          updated_at?: string
          user_id?: string
          validation_attempt_count?: number
          validation_claim_digest?: string | null
          validation_lease_expires_at?: string | null
          vault_key_version?: string | null
        }
        Relationships: []
      }
      apple_auth_server_events: {
        Row: {
          apple_subject_hmac: string
          client_id: string
          event_at: string
          event_type: string
          id: number
          jti_hmac: string
          payload_hmac: string
          received_at: string
          relay_email_hmac: string | null
          result_code: string
          subject_hmac_key_version: string
          user_id: string | null
        }
        Insert: {
          apple_subject_hmac: string
          client_id: string
          event_at: string
          event_type: string
          id?: never
          jti_hmac: string
          payload_hmac: string
          received_at?: string
          relay_email_hmac?: string | null
          result_code: string
          subject_hmac_key_version: string
          user_id?: string | null
        }
        Update: {
          apple_subject_hmac?: string
          client_id?: string
          event_at?: string
          event_type?: string
          id?: never
          jti_hmac?: string
          payload_hmac?: string
          received_at?: string
          relay_email_hmac?: string | null
          result_code?: string
          subject_hmac_key_version?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ask_safety_audit: {
        Row: {
          accessed_log: Json
          content_enc: string
          created_at: string
          expires_at: string
          id: string
          turn_audit_id: string
          user_id: string
        }
        Insert: {
          accessed_log?: Json
          content_enc: string
          created_at?: string
          expires_at: string
          id?: string
          turn_audit_id: string
          user_id: string
        }
        Update: {
          accessed_log?: Json
          content_enc?: string
          created_at?: string
          expires_at?: string
          id?: string
          turn_audit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ask_safety_audit_turn_audit_id_fkey"
            columns: ["turn_audit_id"]
            isOneToOne: false
            referencedRelation: "ask_turn_audit"
            referencedColumns: ["id"]
          },
        ]
      }
      ask_sessions: {
        Row: {
          ended_clean: boolean
          grounded_rate: number | null
          id: string
          last_intent: string | null
          model_tier: string | null
          started_at: string
          turn_count: number
          user_id: string
        }
        Insert: {
          ended_clean?: boolean
          grounded_rate?: number | null
          id?: string
          last_intent?: string | null
          model_tier?: string | null
          started_at?: string
          turn_count?: number
          user_id: string
        }
        Update: {
          ended_clean?: boolean
          grounded_rate?: number | null
          id?: string
          last_intent?: string | null
          model_tier?: string | null
          started_at?: string
          turn_count?: number
          user_id?: string
        }
        Relationships: []
      }
      ask_turn_audit: {
        Row: {
          answer_kind: string
          citation_faithful: boolean | null
          claimsafety_ok: boolean
          corpus_version: string | null
          created_at: string
          est_cost_usd: number | null
          id: string
          intent: string
          model_id_version: string | null
          narration_engine_mismatch: boolean
          session_id: string
          system_prompt_hash: string | null
          was_escalated: boolean
          was_grounded: boolean
          was_refused: boolean
        }
        Insert: {
          answer_kind: string
          citation_faithful?: boolean | null
          claimsafety_ok: boolean
          corpus_version?: string | null
          created_at?: string
          est_cost_usd?: number | null
          id?: string
          intent: string
          model_id_version?: string | null
          narration_engine_mismatch?: boolean
          session_id: string
          system_prompt_hash?: string | null
          was_escalated: boolean
          was_grounded: boolean
          was_refused: boolean
        }
        Update: {
          answer_kind?: string
          citation_faithful?: boolean | null
          claimsafety_ok?: boolean
          corpus_version?: string | null
          created_at?: string
          est_cost_usd?: number | null
          id?: string
          intent?: string
          model_id_version?: string | null
          narration_engine_mismatch?: boolean
          session_id?: string
          system_prompt_hash?: string | null
          was_escalated?: boolean
          was_grounded?: boolean
          was_refused?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ask_turn_audit_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ask_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          display_name: string
          id: string
          normalized_name: string
          review_status: string
          source_id: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          normalized_name: string
          review_status?: string
          source_id?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          normalized_name?: string
          review_status?: string
          source_id?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_corrections: {
        Row: {
          assigned_to: string | null
          barcode: string | null
          client_context: Json
          correction_type: string
          created_at: string
          description: string | null
          id: string
          intake_health_epoch: number | null
          intake_request_digest: string | null
          intake_request_id: string | null
          operator_review_note: string | null
          operator_reviewed_at: string | null
          operator_reviewed_by: string | null
          product_id: string | null
          proposed_payload: Json
          resolution_note: string | null
          resolved_by: string | null
          source_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          barcode?: string | null
          client_context?: Json
          correction_type: string
          created_at?: string
          description?: string | null
          id?: string
          intake_health_epoch?: number | null
          intake_request_digest?: string | null
          intake_request_id?: string | null
          operator_review_note?: string | null
          operator_reviewed_at?: string | null
          operator_reviewed_by?: string | null
          product_id?: string | null
          proposed_payload?: Json
          resolution_note?: string | null
          resolved_by?: string | null
          source_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          barcode?: string | null
          client_context?: Json
          correction_type?: string
          created_at?: string
          description?: string | null
          id?: string
          intake_health_epoch?: number | null
          intake_request_digest?: string | null
          intake_request_id?: string | null
          operator_review_note?: string | null
          operator_reviewed_at?: string | null
          operator_reviewed_by?: string | null
          product_id?: string | null
          proposed_payload?: Json
          resolution_note?: string | null
          resolved_by?: string | null
          source_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_corrections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_corrections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_corrections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_corrections_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_import_batches: {
        Row: {
          accepted_record_count: number
          approved_at: string | null
          artifact_kind: string | null
          artifact_sha256: string | null
          artifact_uri: string | null
          batch_type: string
          candidates_sha256: string | null
          conflict_record_count: number
          created_at: string
          created_by: string | null
          duplicate_record_count: number
          expected_record_count: number | null
          finalize_operation_key: string | null
          finalize_request_sha256: string | null
          finalized_at: string | null
          finished_at: string | null
          id: string
          ingredient_count: number
          manifest: Json
          manifest_sha256: string | null
          operation_key: string | null
          parser_version: string | null
          product_count: number
          promoted_at: string | null
          qa_blocker_count: number
          qa_report_sha256: string | null
          qa_report_uri: string | null
          qa_warning_count: number
          records_sha256: string | null
          rejected_record_count: number
          request_sha256: string | null
          retired_at: string | null
          review_evidence_sha256: string | null
          review_operation_key: string | null
          review_request_sha256: string | null
          review_ticket: string | null
          reviewed_by: string | null
          reviewer_ids: string[] | null
          rollback_reason: string | null
          snapshot_date: string
          source_approval_sha256: string | null
          source_id: string
          source_policy_sha256: string | null
          staged_record_count: number
          started_at: string | null
          status: string
          territory: string | null
          transform_sha256: string | null
          transformed_payload_sha256: string | null
          verification_evidence_sha256: string | null
          verification_operation_key: string | null
          verification_request_sha256: string | null
          verified_at: string | null
        }
        Insert: {
          accepted_record_count?: number
          approved_at?: string | null
          artifact_kind?: string | null
          artifact_sha256?: string | null
          artifact_uri?: string | null
          batch_type: string
          candidates_sha256?: string | null
          conflict_record_count?: number
          created_at?: string
          created_by?: string | null
          duplicate_record_count?: number
          expected_record_count?: number | null
          finalize_operation_key?: string | null
          finalize_request_sha256?: string | null
          finalized_at?: string | null
          finished_at?: string | null
          id?: string
          ingredient_count?: number
          manifest?: Json
          manifest_sha256?: string | null
          operation_key?: string | null
          parser_version?: string | null
          product_count?: number
          promoted_at?: string | null
          qa_blocker_count?: number
          qa_report_sha256?: string | null
          qa_report_uri?: string | null
          qa_warning_count?: number
          records_sha256?: string | null
          rejected_record_count?: number
          request_sha256?: string | null
          retired_at?: string | null
          review_evidence_sha256?: string | null
          review_operation_key?: string | null
          review_request_sha256?: string | null
          review_ticket?: string | null
          reviewed_by?: string | null
          reviewer_ids?: string[] | null
          rollback_reason?: string | null
          snapshot_date: string
          source_approval_sha256?: string | null
          source_id: string
          source_policy_sha256?: string | null
          staged_record_count?: number
          started_at?: string | null
          status?: string
          territory?: string | null
          transform_sha256?: string | null
          transformed_payload_sha256?: string | null
          verification_evidence_sha256?: string | null
          verification_operation_key?: string | null
          verification_request_sha256?: string | null
          verified_at?: string | null
        }
        Update: {
          accepted_record_count?: number
          approved_at?: string | null
          artifact_kind?: string | null
          artifact_sha256?: string | null
          artifact_uri?: string | null
          batch_type?: string
          candidates_sha256?: string | null
          conflict_record_count?: number
          created_at?: string
          created_by?: string | null
          duplicate_record_count?: number
          expected_record_count?: number | null
          finalize_operation_key?: string | null
          finalize_request_sha256?: string | null
          finalized_at?: string | null
          finished_at?: string | null
          id?: string
          ingredient_count?: number
          manifest?: Json
          manifest_sha256?: string | null
          operation_key?: string | null
          parser_version?: string | null
          product_count?: number
          promoted_at?: string | null
          qa_blocker_count?: number
          qa_report_sha256?: string | null
          qa_report_uri?: string | null
          qa_warning_count?: number
          records_sha256?: string | null
          rejected_record_count?: number
          request_sha256?: string | null
          retired_at?: string | null
          review_evidence_sha256?: string | null
          review_operation_key?: string | null
          review_request_sha256?: string | null
          review_ticket?: string | null
          reviewed_by?: string | null
          reviewer_ids?: string[] | null
          rollback_reason?: string | null
          snapshot_date?: string
          source_approval_sha256?: string | null
          source_id?: string
          source_policy_sha256?: string | null
          staged_record_count?: number
          started_at?: string | null
          status?: string
          territory?: string | null
          transform_sha256?: string | null
          transformed_payload_sha256?: string | null
          verification_evidence_sha256?: string | null
          verification_operation_key?: string | null
          verification_request_sha256?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_import_batches_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_lookup_events: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          lookup_type: string
          matched_product_id: string | null
          quality_grade: string | null
          query: string | null
          result: string
          source_key: string | null
          user_id: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          lookup_type: string
          matched_product_id?: string | null
          quality_grade?: string | null
          query?: string | null
          result: string
          source_key?: string | null
          user_id: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          lookup_type?: string
          matched_product_id?: string | null
          quality_grade?: string | null
          query?: string | null
          result?: string
          source_key?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_lookup_events_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_lookup_events_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_lookup_events_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_quality_reports: {
        Row: {
          batch_id: string | null
          blocker_count: number
          created_at: string
          generated_at: string
          id: string
          metrics: Json
          report_type: string
          warning_count: number
        }
        Insert: {
          batch_id?: string | null
          blocker_count?: number
          created_at?: string
          generated_at?: string
          id?: string
          metrics?: Json
          report_type?: string
          warning_count?: number
        }
        Update: {
          batch_id?: string | null
          blocker_count?: number
          created_at?: string
          generated_at?: string
          id?: string
          metrics?: Json
          report_type?: string
          warning_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_quality_reports_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "catalog_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_sources: {
        Row: {
          allows_images: boolean
          attribution_text: string | null
          attribution_url: string | null
          created_at: string
          display_name: string
          id: string
          license_name: string | null
          license_url: string | null
          notes: string | null
          production_approved: boolean
          requires_attribution: boolean
          requires_share_alike: boolean
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_key: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          allows_images?: boolean
          attribution_text?: string | null
          attribution_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          license_name?: string | null
          license_url?: string | null
          notes?: string | null
          production_approved?: boolean
          requires_attribution?: boolean
          requires_share_alike?: boolean
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          allows_images?: boolean
          attribution_text?: string | null
          attribution_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          license_name?: string | null
          license_url?: string | null
          notes?: string | null
          production_approved?: boolean
          requires_attribution?: boolean
          requires_share_alike?: boolean
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_key?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      commerce_click_events: {
        Row: {
          affiliate_link_id: string | null
          click_token: string
          consented: boolean
          created_at: string
          data_sharing_generation: number
          health_processing_epoch: number
          id: string
          product_type: string | null
          source: string
          user_id: string
        }
        Insert: {
          affiliate_link_id?: string | null
          click_token: string
          consented?: boolean
          created_at?: string
          data_sharing_generation: number
          health_processing_epoch: number
          id?: string
          product_type?: string | null
          source?: string
          user_id: string
        }
        Update: {
          affiliate_link_id?: string | null
          click_token?: string
          consented?: boolean
          created_at?: string
          data_sharing_generation?: number
          health_processing_epoch?: number
          id?: string
          product_type?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_click_events_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
        ]
      }
      community_blocks: {
        Row: {
          blocked_handle: string
          created_at: string
          user_id: string
        }
        Insert: {
          blocked_handle: string
          created_at?: string
          user_id: string
        }
        Update: {
          blocked_handle?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      community_moderation_events: {
        Row: {
          acted_at: string
          action: string
          id: string
          question_id: string | null
          reason: string | null
        }
        Insert: {
          acted_at?: string
          action: string
          id?: string
          question_id?: string | null
          reason?: string | null
        }
        Update: {
          acted_at?: string
          action?: string
          id?: string
          question_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_moderation_events_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "community_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_notes: {
        Row: {
          author_credential: string | null
          body: string
          claim_safety_ok: boolean
          created_at: string
          evidence_grade: string | null
          evidence_label: string | null
          id: string
          kind: string
          provenance: string
          reviewed_by: string | null
          source_url: string | null
          title: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          author_credential?: string | null
          body: string
          claim_safety_ok?: boolean
          created_at?: string
          evidence_grade?: string | null
          evidence_label?: string | null
          id?: string
          kind: string
          provenance?: string
          reviewed_by?: string | null
          source_url?: string | null
          title: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          author_credential?: string | null
          body?: string
          claim_safety_ok?: boolean
          created_at?: string
          evidence_grade?: string | null
          evidence_label?: string | null
          id?: string
          kind?: string
          provenance?: string
          reviewed_by?: string | null
          source_url?: string | null
          title?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_notes_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "community_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      community_questions: {
        Row: {
          anon_handle: string
          body: string
          claim_safety_flag: boolean | null
          consent_grant_id: string
          created_at: string
          id: string
          moderation_state: string
          rejected_reason: string | null
          topic_id: string
          user_id: string
        }
        Insert: {
          anon_handle: string
          body: string
          claim_safety_flag?: boolean | null
          consent_grant_id: string
          created_at?: string
          id?: string
          moderation_state?: string
          rejected_reason?: string | null
          topic_id: string
          user_id: string
        }
        Update: {
          anon_handle?: string
          body?: string
          claim_safety_flag?: boolean | null
          consent_grant_id?: string
          created_at?: string
          id?: string
          moderation_state?: string
          rejected_reason?: string | null
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_questions_consent_grant_id_fkey"
            columns: ["consent_grant_id"]
            isOneToOne: false
            referencedRelation: "consents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "community_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reactions: {
        Row: {
          created_at: string
          id: string
          note_id: string | null
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id?: string | null
          reaction: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string | null
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_reactions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "community_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      community_reports: {
        Row: {
          created_at: string
          id: string
          question_id: string | null
          reason: string
          reporter_id: string
          resolved_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          question_id?: string | null
          reason: string
          reporter_id: string
          resolved_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string | null
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "community_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      community_topics: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          slug: string
          sort_order: number
          title: string
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          slug: string
          sort_order?: number
          title: string
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          slug?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      conflict_rules: {
        Row: {
          applies_when: Json | null
          base_severity: string
          evidence_grade: string | null
          evidence_label: string
          id: string
          interaction_type: string
          is_active: boolean
          mechanism: string
          resolution_copy: string
          resolution_type: string
          reviewed_by: string | null
          rule_version: number
          source_citation: string
          tag_a: string
          tag_b: string
        }
        Insert: {
          applies_when?: Json | null
          base_severity: string
          evidence_grade?: string | null
          evidence_label: string
          id?: string
          interaction_type: string
          is_active?: boolean
          mechanism: string
          resolution_copy: string
          resolution_type: string
          reviewed_by?: string | null
          rule_version?: number
          source_citation: string
          tag_a: string
          tag_b: string
        }
        Update: {
          applies_when?: Json | null
          base_severity?: string
          evidence_grade?: string | null
          evidence_label?: string
          id?: string
          interaction_type?: string
          is_active?: boolean
          mechanism?: string
          resolution_copy?: string
          resolution_type?: string
          reviewed_by?: string | null
          rule_version?: number
          source_citation?: string
          tag_a?: string
          tag_b?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          consent_text_hash: string | null
          consent_type: string
          granted: boolean
          granted_at: string
          id: string
          ip: unknown
          revoked_at: string | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          consent_text_hash?: string | null
          consent_type: string
          granted: boolean
          granted_at?: string
          id?: string
          ip?: unknown
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          consent_text_hash?: string | null
          consent_type?: string
          granted?: boolean
          granted_at?: string
          id?: string
          ip?: unknown
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      creator_stack_items: {
        Row: {
          catalog_product_id: string | null
          id: string
          note: string | null
          position: number
          product_type: string
          role_label: string
          stack_id: string
        }
        Insert: {
          catalog_product_id?: string | null
          id?: string
          note?: string | null
          position: number
          product_type: string
          role_label: string
          stack_id: string
        }
        Update: {
          catalog_product_id?: string | null
          id?: string
          note?: string | null
          position?: number
          product_type?: string
          role_label?: string
          stack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_stack_items_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_stack_items_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_stack_items_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_stack_items_stack_id_fkey"
            columns: ["stack_id"]
            isOneToOne: false
            referencedRelation: "creator_stacks"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_stacks: {
        Row: {
          created_at: string
          curator: string
          curator_kind: string
          id: string
          is_active: boolean
          reviewed_by: string | null
          slug: string
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          curator: string
          curator_kind?: string
          id?: string
          is_active?: boolean
          reviewed_by?: string | null
          slug: string
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          curator?: string
          curator_kind?: string
          id?: string
          is_active?: boolean
          reviewed_by?: string | null
          slug?: string
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      cycle_nights: {
        Row: {
          cycle_id: string
          night_index: number
          slot: string
          user_product_id: string | null
        }
        Insert: {
          cycle_id: string
          night_index: number
          slot: string
          user_product_id?: string | null
        }
        Update: {
          cycle_id?: string
          night_index?: number
          slot?: string
          user_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_nights_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_nights_user_product_id_fkey"
            columns: ["user_product_id"]
            isOneToOne: false
            referencedRelation: "user_products"
            referencedColumns: ["id"]
          },
        ]
      }
      cycles: {
        Row: {
          anchor_date: string
          created_at: string
          id: string
          is_active: boolean
          length_nights: number
          paused_from: string | null
          updated_at: string
          user_id: string
          variant: string
        }
        Insert: {
          anchor_date: string
          created_at?: string
          id?: string
          is_active?: boolean
          length_nights?: number
          paused_from?: string | null
          updated_at?: string
          user_id: string
          variant?: string
        }
        Update: {
          anchor_date?: string
          created_at?: string
          id?: string
          is_active?: boolean
          length_nights?: number
          paused_from?: string | null
          updated_at?: string
          user_id?: string
          variant?: string
        }
        Relationships: []
      }
      edge_rate_limits: {
        Row: {
          created_at: string
          expires_at: string
          key_hash: string
          owner_user_id: string | null
          request_count: number
          scope: string
          updated_at: string
          window_seconds: number
          window_start: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          key_hash: string
          owner_user_id?: string | null
          request_count?: number
          scope: string
          updated_at?: string
          window_seconds: number
          window_start: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key_hash?: string
          owner_user_id?: string | null
          request_count?: number
          scope?: string
          updated_at?: string
          window_seconds?: number
          window_start?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          acquisition_channel: string | null
          entitlement: string | null
          environment: string | null
          experiment_id: string | null
          expires_at: string | null
          is_active: boolean
          last_reconciled_at: string | null
          management_url: string | null
          offering_id: string | null
          original_purchase_at: string | null
          package_id: string | null
          period_type: string | null
          product_id: string | null
          raw_status: Json
          rc_cursor_state: string
          rc_event_at: string | null
          rc_event_id: string | null
          rc_event_priority: number | null
          rc_original_transaction_id: string | null
          rc_snapshot_at: string | null
          rc_snapshot_fingerprint: string | null
          rc_transaction_id: string | null
          source: string
          store: string | null
          store_user_id: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          will_renew: boolean | null
        }
        Insert: {
          acquisition_channel?: string | null
          entitlement?: string | null
          environment?: string | null
          experiment_id?: string | null
          expires_at?: string | null
          is_active?: boolean
          last_reconciled_at?: string | null
          management_url?: string | null
          offering_id?: string | null
          original_purchase_at?: string | null
          package_id?: string | null
          period_type?: string | null
          product_id?: string | null
          raw_status?: Json
          rc_cursor_state?: string
          rc_event_at?: string | null
          rc_event_id?: string | null
          rc_event_priority?: number | null
          rc_original_transaction_id?: string | null
          rc_snapshot_at?: string | null
          rc_snapshot_fingerprint?: string | null
          rc_transaction_id?: string | null
          source: string
          store?: string | null
          store_user_id?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          will_renew?: boolean | null
        }
        Update: {
          acquisition_channel?: string | null
          entitlement?: string | null
          environment?: string | null
          experiment_id?: string | null
          expires_at?: string | null
          is_active?: boolean
          last_reconciled_at?: string | null
          management_url?: string | null
          offering_id?: string | null
          original_purchase_at?: string | null
          package_id?: string | null
          period_type?: string | null
          product_id?: string | null
          raw_status?: Json
          rc_cursor_state?: string
          rc_event_at?: string | null
          rc_event_id?: string | null
          rc_event_priority?: number | null
          rc_original_transaction_id?: string | null
          rc_snapshot_at?: string | null
          rc_snapshot_fingerprint?: string | null
          rc_transaction_id?: string | null
          source?: string
          store?: string | null
          store_user_id?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          will_renew?: boolean | null
        }
        Relationships: []
      }
      growth_events: {
        Row: {
          app_version: string | null
          build_number: string | null
          campaign: string | null
          content: string | null
          created_at: string
          creative_variant: string | null
          event: string
          id: string
          landing_variant: string | null
          medium: string | null
          platform: string | null
          share_id: string | null
          source: string | null
          store: string | null
          term: string | null
        }
        Insert: {
          app_version?: string | null
          build_number?: string | null
          campaign?: string | null
          content?: string | null
          created_at?: string
          creative_variant?: string | null
          event: string
          id?: string
          landing_variant?: string | null
          medium?: string | null
          platform?: string | null
          share_id?: string | null
          source?: string | null
          store?: string | null
          term?: string | null
        }
        Update: {
          app_version?: string | null
          build_number?: string | null
          campaign?: string | null
          content?: string | null
          created_at?: string
          creative_variant?: string | null
          event?: string
          id?: string
          landing_variant?: string | null
          medium?: string | null
          platform?: string | null
          share_id?: string | null
          source?: string | null
          store?: string | null
          term?: string | null
        }
        Relationships: []
      }
      health_consent_copy_registry: {
        Row: {
          action: string
          consent_text_hash: string
          consent_type: string
          created_at: string
          is_current: boolean
          review_status: string
          version: string
        }
        Insert: {
          action: string
          consent_text_hash: string
          consent_type: string
          created_at?: string
          is_current?: boolean
          review_status: string
          version: string
        }
        Update: {
          action?: string
          consent_text_hash?: string
          consent_type?: string
          created_at?: string
          is_current?: boolean
          review_status?: string
          version?: string
        }
        Relationships: []
      }
      health_consent_copy_review_events: {
        Row: {
          action: string
          consent_text_hash: string
          consent_type: string
          event_type: string
          from_is_current: boolean
          from_status: string
          id: string
          lifecycle_backend_pid: number
          lifecycle_xid: unknown
          review_evidence_hash: string
          review_ticket: string
          reviewed_at: string
          reviewed_by: string
          successor_consent_text_hash: string | null
          successor_is_current: boolean | null
          successor_review_status: string | null
          successor_version: string | null
          to_is_current: boolean
          to_status: string
          version: string
        }
        Insert: {
          action: string
          consent_text_hash: string
          consent_type: string
          event_type: string
          from_is_current: boolean
          from_status: string
          id?: string
          lifecycle_backend_pid: number
          lifecycle_xid: unknown
          review_evidence_hash: string
          review_ticket: string
          reviewed_at?: string
          reviewed_by: string
          successor_consent_text_hash?: string | null
          successor_is_current?: boolean | null
          successor_review_status?: string | null
          successor_version?: string | null
          to_is_current: boolean
          to_status: string
          version: string
        }
        Update: {
          action?: string
          consent_text_hash?: string
          consent_type?: string
          event_type?: string
          from_is_current?: boolean
          from_status?: string
          id?: string
          lifecycle_backend_pid?: number
          lifecycle_xid?: unknown
          review_evidence_hash?: string
          review_ticket?: string
          reviewed_at?: string
          reviewed_by?: string
          successor_consent_text_hash?: string | null
          successor_is_current?: boolean | null
          successor_review_status?: string | null
          successor_version?: string | null
          to_is_current?: boolean
          to_status?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_consent_copy_review_ev_consent_type_action_successo_fkey"
            columns: [
              "consent_type",
              "action",
              "successor_version",
              "successor_consent_text_hash",
            ]
            isOneToOne: false
            referencedRelation: "health_consent_copy_registry"
            referencedColumns: [
              "consent_type",
              "action",
              "version",
              "consent_text_hash",
            ]
          },
          {
            foreignKeyName: "health_consent_copy_review_ev_consent_type_action_version__fkey"
            columns: ["consent_type", "action", "version", "consent_text_hash"]
            isOneToOne: false
            referencedRelation: "health_consent_copy_registry"
            referencedColumns: [
              "consent_type",
              "action",
              "version",
              "consent_text_hash",
            ]
          },
        ]
      }
      health_consent_copy_staging_events: {
        Row: {
          action: string
          consent_type: string
          id: string
          lifecycle_backend_pid: number
          lifecycle_xid: unknown
          previous_consent_text_hash: string
          previous_from_is_current: boolean
          previous_review_status: string
          previous_to_is_current: boolean
          previous_version: string
          staged_at: string
          staged_by: string
          staging_change_reference: string
          staging_evidence_hash: string
          successor_consent_text_hash: string
          successor_from_is_current: boolean
          successor_review_status: string
          successor_to_is_current: boolean
          successor_version: string
        }
        Insert: {
          action: string
          consent_type: string
          id?: string
          lifecycle_backend_pid: number
          lifecycle_xid: unknown
          previous_consent_text_hash: string
          previous_from_is_current: boolean
          previous_review_status: string
          previous_to_is_current: boolean
          previous_version: string
          staged_at?: string
          staged_by: string
          staging_change_reference: string
          staging_evidence_hash: string
          successor_consent_text_hash: string
          successor_from_is_current: boolean
          successor_review_status: string
          successor_to_is_current: boolean
          successor_version: string
        }
        Update: {
          action?: string
          consent_type?: string
          id?: string
          lifecycle_backend_pid?: number
          lifecycle_xid?: unknown
          previous_consent_text_hash?: string
          previous_from_is_current?: boolean
          previous_review_status?: string
          previous_to_is_current?: boolean
          previous_version?: string
          staged_at?: string
          staged_by?: string
          staging_change_reference?: string
          staging_evidence_hash?: string
          successor_consent_text_hash?: string
          successor_from_is_current?: boolean
          successor_review_status?: string
          successor_to_is_current?: boolean
          successor_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_consent_copy_staging_e_consent_type_action_previous_fkey"
            columns: [
              "consent_type",
              "action",
              "previous_version",
              "previous_consent_text_hash",
            ]
            isOneToOne: true
            referencedRelation: "health_consent_copy_registry"
            referencedColumns: [
              "consent_type",
              "action",
              "version",
              "consent_text_hash",
            ]
          },
          {
            foreignKeyName: "health_consent_copy_staging_e_consent_type_action_successo_fkey"
            columns: [
              "consent_type",
              "action",
              "successor_version",
              "successor_consent_text_hash",
            ]
            isOneToOne: true
            referencedRelation: "health_consent_copy_registry"
            referencedColumns: [
              "consent_type",
              "action",
              "version",
              "consent_text_hash",
            ]
          },
        ]
      }
      health_consent_withdrawal_operations: {
        Row: {
          attempt_count: number
          completed_at: string | null
          epoch: number
          id: string
          idempotency_digest: string
          last_result_code: string | null
          next_attempt_at: string
          processor_inventory_hash: string
          processor_inventory_version: string
          requested_at: string
          state: string
          updated_at: string
          user_id: string
          worker_claim_digest: string | null
          worker_lease_expires_at: string | null
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          epoch: number
          id?: string
          idempotency_digest: string
          last_result_code?: string | null
          next_attempt_at?: string
          processor_inventory_hash?: string
          processor_inventory_version?: string
          requested_at?: string
          state?: string
          updated_at?: string
          user_id: string
          worker_claim_digest?: string | null
          worker_lease_expires_at?: string | null
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          epoch?: number
          id?: string
          idempotency_digest?: string
          last_result_code?: string | null
          next_attempt_at?: string
          processor_inventory_hash?: string
          processor_inventory_version?: string
          requested_at?: string
          state?: string
          updated_at?: string
          user_id?: string
          worker_claim_digest?: string | null
          worker_lease_expires_at?: string | null
        }
        Relationships: []
      }
      health_consent_withdrawal_steps: {
        Row: {
          attempt_count: number
          completed_at: string | null
          operation_id: string
          result_code: string | null
          started_at: string | null
          status: string
          step_name: string
          step_order: number
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          completed_at?: string | null
          operation_id: string
          result_code?: string | null
          started_at?: string | null
          status?: string
          step_name: string
          step_order: number
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          completed_at?: string | null
          operation_id?: string
          result_code?: string | null
          started_at?: string | null
          status?: string
          step_name?: string
          step_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_consent_withdrawal_steps_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: false
            referencedRelation: "health_consent_withdrawal_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      health_dependent_consent_operations: {
        Row: {
          action: string
          attempt_count: number
          completed_at: string | null
          consent_generation: number
          consent_text_hash: string
          consent_type: string
          expected_generation: number
          expected_processing_epoch: number
          id: string
          idempotency_digest: string
          last_result_code: string | null
          next_attempt_at: string
          receipt_id: string | null
          requested_at: string
          state: string
          updated_at: string
          user_id: string
          version: string
          worker_claim_digest: string | null
          worker_lease_expires_at: string | null
        }
        Insert: {
          action: string
          attempt_count?: number
          completed_at?: string | null
          consent_generation: number
          consent_text_hash: string
          consent_type: string
          expected_generation: number
          expected_processing_epoch: number
          id?: string
          idempotency_digest: string
          last_result_code?: string | null
          next_attempt_at?: string
          receipt_id?: string | null
          requested_at?: string
          state?: string
          updated_at?: string
          user_id: string
          version: string
          worker_claim_digest?: string | null
          worker_lease_expires_at?: string | null
        }
        Update: {
          action?: string
          attempt_count?: number
          completed_at?: string | null
          consent_generation?: number
          consent_text_hash?: string
          consent_type?: string
          expected_generation?: number
          expected_processing_epoch?: number
          id?: string
          idempotency_digest?: string
          last_result_code?: string | null
          next_attempt_at?: string
          receipt_id?: string | null
          requested_at?: string
          state?: string
          updated_at?: string
          user_id?: string
          version?: string
          worker_claim_digest?: string | null
          worker_lease_expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_dependent_consent_operations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "consents"
            referencedColumns: ["id"]
          },
        ]
      }
      health_dependent_consent_states: {
        Row: {
          base_withdrawal_operation_id: string | null
          consent_text_hash: string | null
          consent_type: string
          created_at: string
          current_operation_id: string | null
          current_receipt_id: string | null
          generation: number
          health_epoch: number | null
          parent_withdrawal_operation_id: string | null
          state: string
          updated_at: string
          user_id: string
          version: string | null
          withdrawal_completed_at: string | null
          withdrawal_requested_at: string | null
        }
        Insert: {
          base_withdrawal_operation_id?: string | null
          consent_text_hash?: string | null
          consent_type: string
          created_at?: string
          current_operation_id?: string | null
          current_receipt_id?: string | null
          generation?: number
          health_epoch?: number | null
          parent_withdrawal_operation_id?: string | null
          state?: string
          updated_at?: string
          user_id: string
          version?: string | null
          withdrawal_completed_at?: string | null
          withdrawal_requested_at?: string | null
        }
        Update: {
          base_withdrawal_operation_id?: string | null
          consent_text_hash?: string | null
          consent_type?: string
          created_at?: string
          current_operation_id?: string | null
          current_receipt_id?: string | null
          generation?: number
          health_epoch?: number | null
          parent_withdrawal_operation_id?: string | null
          state?: string
          updated_at?: string
          user_id?: string
          version?: string | null
          withdrawal_completed_at?: string | null
          withdrawal_requested_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_dependent_consent_stat_base_withdrawal_operation_id_fkey"
            columns: ["base_withdrawal_operation_id", "user_id"]
            isOneToOne: false
            referencedRelation: "health_consent_withdrawal_operations"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "health_dependent_consent_stat_current_operation_id_user_id_fkey"
            columns: ["current_operation_id", "user_id", "consent_type"]
            isOneToOne: false
            referencedRelation: "health_dependent_consent_operations"
            referencedColumns: ["id", "user_id", "consent_type"]
          },
          {
            foreignKeyName: "health_dependent_consent_stat_parent_withdrawal_operation__fkey"
            columns: ["parent_withdrawal_operation_id"]
            isOneToOne: false
            referencedRelation: "health_dependent_consent_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_dependent_consent_states_current_receipt_id_fkey"
            columns: ["current_receipt_id"]
            isOneToOne: false
            referencedRelation: "consents"
            referencedColumns: ["id"]
          },
        ]
      }
      health_processing_states: {
        Row: {
          consent_text_hash: string | null
          consent_version: string | null
          created_at: string
          current_operation_id: string | null
          epoch: number
          last_server_verified_at: string | null
          receipt_capability_action: string | null
          receipt_capability_backend_pid: number | null
          receipt_capability_consent_type: string | null
          receipt_capability_granted: boolean | null
          receipt_capability_scope: string | null
          receipt_capability_text_hash: string | null
          receipt_capability_version: string | null
          receipt_capability_xid: unknown
          state: string
          updated_at: string
          user_id: string
          withdrawal_completed_at: string | null
          withdrawal_requested_at: string | null
        }
        Insert: {
          consent_text_hash?: string | null
          consent_version?: string | null
          created_at?: string
          current_operation_id?: string | null
          epoch?: number
          last_server_verified_at?: string | null
          receipt_capability_action?: string | null
          receipt_capability_backend_pid?: number | null
          receipt_capability_consent_type?: string | null
          receipt_capability_granted?: boolean | null
          receipt_capability_scope?: string | null
          receipt_capability_text_hash?: string | null
          receipt_capability_version?: string | null
          receipt_capability_xid?: unknown
          state?: string
          updated_at?: string
          user_id: string
          withdrawal_completed_at?: string | null
          withdrawal_requested_at?: string | null
        }
        Update: {
          consent_text_hash?: string | null
          consent_version?: string | null
          created_at?: string
          current_operation_id?: string | null
          epoch?: number
          last_server_verified_at?: string | null
          receipt_capability_action?: string | null
          receipt_capability_backend_pid?: number | null
          receipt_capability_consent_type?: string | null
          receipt_capability_granted?: boolean | null
          receipt_capability_scope?: string | null
          receipt_capability_text_hash?: string | null
          receipt_capability_version?: string | null
          receipt_capability_xid?: unknown
          state?: string
          updated_at?: string
          user_id?: string
          withdrawal_completed_at?: string | null
          withdrawal_requested_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_processing_states_current_operation_id_user_id_fkey"
            columns: ["current_operation_id", "user_id"]
            isOneToOne: false
            referencedRelation: "health_consent_withdrawal_operations"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      ingredient_pao_defaults: {
        Row: {
          category: string
          default_pao_months: number
          rationale: string | null
        }
        Insert: {
          category: string
          default_pao_months: number
          rationale?: string | null
        }
        Update: {
          category?: string
          default_pao_months?: number
          rationale?: string | null
        }
        Relationships: []
      }
      ingredient_synonyms: {
        Row: {
          id: string
          import_batch_id: string | null
          import_projection_status: string | null
          import_record_ordinal: number | null
          import_record_sha256: string | null
          import_staged_record_id: string | null
          ingredient_id: string
          normalized_synonym: string | null
          retired_import_natural_key: string | null
          review_status: string
          source_id: string | null
          synonym: string
        }
        Insert: {
          id?: string
          import_batch_id?: string | null
          import_projection_status?: string | null
          import_record_ordinal?: number | null
          import_record_sha256?: string | null
          import_staged_record_id?: string | null
          ingredient_id: string
          normalized_synonym?: string | null
          retired_import_natural_key?: string | null
          review_status?: string
          source_id?: string | null
          synonym: string
        }
        Update: {
          id?: string
          import_batch_id?: string | null
          import_projection_status?: string | null
          import_record_ordinal?: number | null
          import_record_sha256?: string | null
          import_staged_record_id?: string | null
          ingredient_id?: string
          normalized_synonym?: string | null
          retired_import_natural_key?: string | null
          review_status?: string
          source_id?: string | null
          synonym?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_synonyms_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "catalog_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_synonyms_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_synonyms_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_tag_assignments: {
        Row: {
          created_at: string
          evidence_label: string | null
          id: string
          ingredient_id: string
          parser_version: string | null
          review_status: string
          source_id: string | null
          subflag: string | null
          tag: string
        }
        Insert: {
          created_at?: string
          evidence_label?: string | null
          id?: string
          ingredient_id: string
          parser_version?: string | null
          review_status?: string
          source_id?: string | null
          subflag?: string | null
          tag: string
        }
        Update: {
          created_at?: string
          evidence_label?: string | null
          id?: string
          ingredient_id?: string
          parser_version?: string | null
          review_status?: string
          source_id?: string | null
          subflag?: string | null
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_tag_assignments_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_tag_assignments_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_tag_assignments_tag_fkey"
            columns: ["tag"]
            isOneToOne: false
            referencedRelation: "ingredient_tag_definitions"
            referencedColumns: ["tag"]
          },
        ]
      }
      ingredient_tag_definitions: {
        Row: {
          consumer_copy: string | null
          created_at: string
          evidence_grade: string | null
          label: string
          review_status: string
          reviewed_by: string | null
          tag: string
          tag_group: string
        }
        Insert: {
          consumer_copy?: string | null
          created_at?: string
          evidence_grade?: string | null
          label: string
          review_status?: string
          reviewed_by?: string | null
          tag: string
          tag_group: string
        }
        Update: {
          consumer_copy?: string | null
          created_at?: string
          evidence_grade?: string | null
          label?: string
          review_status?: string
          reviewed_by?: string | null
          tag?: string
          tag_group?: string
        }
        Relationships: []
      }
      ingredient_tags: {
        Row: {
          ingredient_id: string
          subflag: string | null
          tag: string
        }
        Insert: {
          ingredient_id: string
          subflag?: string | null
          tag: string
        }
        Update: {
          ingredient_id?: string
          subflag?: string | null
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_tags_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          annex_conditions: string | null
          annex_status: string | null
          cas_number: string | null
          cosing_ref: string | null
          display_name: string | null
          ec_number: string | null
          id: string
          import_batch_id: string | null
          import_projection_status: string | null
          import_record_ordinal: number | null
          import_record_sha256: string | null
          import_staged_record_id: string | null
          imported_at: string
          inci_name: string
          ingredient_quality_score: number
          normalized_inci_name: string | null
          restriction_summary: string | null
          retired_import_natural_key: string | null
          review_status: string
          source: string
          source_id: string | null
          source_snapshot_date: string | null
          source_url: string | null
        }
        Insert: {
          annex_conditions?: string | null
          annex_status?: string | null
          cas_number?: string | null
          cosing_ref?: string | null
          display_name?: string | null
          ec_number?: string | null
          id?: string
          import_batch_id?: string | null
          import_projection_status?: string | null
          import_record_ordinal?: number | null
          import_record_sha256?: string | null
          import_staged_record_id?: string | null
          imported_at?: string
          inci_name: string
          ingredient_quality_score?: number
          normalized_inci_name?: string | null
          restriction_summary?: string | null
          retired_import_natural_key?: string | null
          review_status?: string
          source?: string
          source_id?: string | null
          source_snapshot_date?: string | null
          source_url?: string | null
        }
        Update: {
          annex_conditions?: string | null
          annex_status?: string | null
          cas_number?: string | null
          cosing_ref?: string | null
          display_name?: string | null
          ec_number?: string | null
          id?: string
          import_batch_id?: string | null
          import_projection_status?: string | null
          import_record_ordinal?: number | null
          import_record_sha256?: string | null
          import_staged_record_id?: string | null
          imported_at?: string
          inci_name?: string
          ingredient_quality_score?: number
          normalized_inci_name?: string | null
          restriction_summary?: string | null
          retired_import_natural_key?: string | null
          review_status?: string
          source?: string
          source_id?: string | null
          source_snapshot_date?: string | null
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "catalog_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredients_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          id: string
          kind: string
          sent_at: string
          tier: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          sent_at?: string
          tier: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          sent_at?: string
          tier?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          am_reminder_enabled: boolean
          am_reminder_time: string | null
          capture_reminders: boolean
          live_activity_enabled: boolean
          lockscreen_discreet: boolean
          pm_reminder_enabled: boolean
          pm_reminder_time: string | null
          promotional_opt_in: boolean
          push_token: string | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          replenishment_alerts: boolean
          streak_nudges: boolean
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          am_reminder_enabled?: boolean
          am_reminder_time?: string | null
          capture_reminders?: boolean
          live_activity_enabled?: boolean
          lockscreen_discreet?: boolean
          pm_reminder_enabled?: boolean
          pm_reminder_time?: string | null
          promotional_opt_in?: boolean
          push_token?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          replenishment_alerts?: boolean
          streak_nudges?: boolean
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          am_reminder_enabled?: boolean
          am_reminder_time?: string | null
          capture_reminders?: boolean
          live_activity_enabled?: boolean
          lockscreen_discreet?: boolean
          pm_reminder_enabled?: boolean
          pm_reminder_time?: string | null
          promotional_opt_in?: boolean
          push_token?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          replenishment_alerts?: boolean
          streak_nudges?: boolean
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      obf_contribution_queue: {
        Row: {
          barcode: string | null
          correction_id: string | null
          created_at: string
          hold_reason: string | null
          id: string
          obf_response: Json | null
          payload: Json
          source_snapshot: Json
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          correction_id?: string | null
          created_at?: string
          hold_reason?: string | null
          id?: string
          obf_response?: Json | null
          payload?: Json
          source_snapshot?: Json
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          correction_id?: string | null
          created_at?: string
          hold_reason?: string | null
          id?: string
          obf_response?: Json | null
          payload?: Json
          source_snapshot?: Json
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obf_contribution_queue_correction_id_fkey"
            columns: ["correction_id"]
            isOneToOne: false
            referencedRelation: "catalog_corrections"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attributions: {
        Row: {
          click_token: string | null
          commission_cents: number | null
          created_at: string
          currency: string | null
          external_order_id: string
          id: string
          order_amount_cents: number | null
          record_updated_at: string | null
          status: string
          transaction_date: string | null
        }
        Insert: {
          click_token?: string | null
          commission_cents?: number | null
          created_at?: string
          currency?: string | null
          external_order_id: string
          id?: string
          order_amount_cents?: number | null
          record_updated_at?: string | null
          status?: string
          transaction_date?: string | null
        }
        Update: {
          click_token?: string | null
          commission_cents?: number | null
          created_at?: string
          currency?: string | null
          external_order_id?: string
          id?: string
          order_amount_cents?: number | null
          record_updated_at?: string | null
          status?: string
          transaction_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_attributions_click_token_fkey"
            columns: ["click_token"]
            isOneToOne: false
            referencedRelation: "commerce_click_events"
            referencedColumns: ["click_token"]
          },
        ]
      }
      photo_trend: {
        Row: {
          capture_session_id: string | null
          change_state: string
          computed_local_date: string
          created_at: string
          delta_metric: number | null
          id: string
          mdc_threshold: number | null
          monk_tone_band: number | null
          narrative_key: string | null
          series: string
          user_id: string
        }
        Insert: {
          capture_session_id?: string | null
          change_state: string
          computed_local_date: string
          created_at?: string
          delta_metric?: number | null
          id?: string
          mdc_threshold?: number | null
          monk_tone_band?: number | null
          narrative_key?: string | null
          series: string
          user_id: string
        }
        Update: {
          capture_session_id?: string | null
          change_state?: string
          computed_local_date?: string
          created_at?: string
          delta_metric?: number | null
          id?: string
          mdc_threshold?: number | null
          monk_tone_band?: number | null
          narrative_key?: string | null
          series?: string
          user_id?: string
        }
        Relationships: []
      }
      photos: {
        Row: {
          alignment_score: number | null
          capture_session_id: string | null
          created_at: string
          face_region_redacted: boolean
          head_pitch: number | null
          head_roll: number | null
          head_yaw: number | null
          id: string
          is_encrypted: boolean
          lighting_score: number | null
          local_only: boolean
          local_uri: string | null
          notes: string | null
          quality_source: string | null
          reference_photo_id: string | null
          series: string
          storage_path: string | null
          taken_at: string
          taken_local_date: string
          time_of_day: string | null
          user_id: string
        }
        Insert: {
          alignment_score?: number | null
          capture_session_id?: string | null
          created_at?: string
          face_region_redacted?: boolean
          head_pitch?: number | null
          head_roll?: number | null
          head_yaw?: number | null
          id?: string
          is_encrypted?: boolean
          lighting_score?: number | null
          local_only?: boolean
          local_uri?: string | null
          notes?: string | null
          quality_source?: string | null
          reference_photo_id?: string | null
          series?: string
          storage_path?: string | null
          taken_at?: string
          taken_local_date?: string
          time_of_day?: string | null
          user_id: string
        }
        Update: {
          alignment_score?: number | null
          capture_session_id?: string | null
          created_at?: string
          face_region_redacted?: boolean
          head_pitch?: number | null
          head_roll?: number | null
          head_yaw?: number | null
          id?: string
          is_encrypted?: boolean
          lighting_score?: number | null
          local_only?: boolean
          local_uri?: string | null
          notes?: string | null
          quality_source?: string | null
          reference_photo_id?: string | null
          series?: string
          storage_path?: string | null
          taken_at?: string
          taken_local_date?: string
          time_of_day?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_reference_photo_id_fkey"
            columns: ["reference_photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
        ]
      }
      product_active_bands: {
        Row: {
          band: string
          created_at: string
          evidence_note: string | null
          exact_percent: number | null
          id: string
          ingredient_id: string | null
          product_id: string
          review_status: string
          source_basis: string
          source_id: string | null
          tag: string | null
        }
        Insert: {
          band: string
          created_at?: string
          evidence_note?: string | null
          exact_percent?: number | null
          id?: string
          ingredient_id?: string | null
          product_id: string
          review_status?: string
          source_basis?: string
          source_id?: string | null
          tag?: string | null
        }
        Update: {
          band?: string
          created_at?: string
          evidence_note?: string | null
          exact_percent?: number | null
          id?: string
          ingredient_id?: string | null
          product_id?: string
          review_status?: string
          source_basis?: string
          source_id?: string | null
          tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_active_bands_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_active_bands_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_active_bands_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_active_bands_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_active_bands_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      product_barcodes: {
        Row: {
          barcode: string
          barcode_type: string
          confidence: number
          first_seen_at: string
          import_batch_id: string | null
          import_entity_id: string | null
          import_projection_status: string | null
          import_record_ordinal: number | null
          import_record_sha256: string | null
          import_staged_record_id: string | null
          last_seen_at: string
          product_id: string
          retired_import_natural_key: string | null
          review_status: string
          source_id: string | null
        }
        Insert: {
          barcode: string
          barcode_type?: string
          confidence?: number
          first_seen_at?: string
          import_batch_id?: string | null
          import_entity_id?: string | null
          import_projection_status?: string | null
          import_record_ordinal?: number | null
          import_record_sha256?: string | null
          import_staged_record_id?: string | null
          last_seen_at?: string
          product_id: string
          retired_import_natural_key?: string | null
          review_status?: string
          source_id?: string | null
        }
        Update: {
          barcode?: string
          barcode_type?: string
          confidence?: number
          first_seen_at?: string
          import_batch_id?: string | null
          import_entity_id?: string | null
          import_projection_status?: string | null
          import_record_ordinal?: number | null
          import_record_sha256?: string | null
          import_staged_record_id?: string | null
          last_seen_at?: string
          product_id?: string
          retired_import_natural_key?: string | null
          review_status?: string
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_barcodes_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "catalog_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_barcodes_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          default_pao_months: number | null
          id: string
          is_otc_drug_candidate: boolean
          is_sunscreen: boolean
          label: string
          pao_source: string
          parent_id: string | null
          review_status: string
          routine_role: string | null
        }
        Insert: {
          created_at?: string
          default_pao_months?: number | null
          id: string
          is_otc_drug_candidate?: boolean
          is_sunscreen?: boolean
          label: string
          pao_source?: string
          parent_id?: string | null
          review_status?: string
          routine_role?: string | null
        }
        Update: {
          created_at?: string
          default_pao_months?: number | null
          id?: string
          is_otc_drug_candidate?: boolean
          is_sunscreen?: boolean
          label?: string
          pao_source?: string
          parent_id?: string | null
          review_status?: string
          routine_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredient_lists: {
        Row: {
          active_section_found: boolean
          created_at: string
          id: string
          import_batch_id: string | null
          import_projection_status: string | null
          import_record_ordinal: number | null
          import_record_sha256: string | null
          import_staged_record_id: string | null
          inactive_section_found: boolean
          locale: string
          may_contain_section_found: boolean
          parse_confidence: number
          parse_status: string
          parser_version: string | null
          product_id: string
          raw_text: string
          review_status: string
          source_id: string | null
          source_snapshot_date: string | null
          token_count: number
          unmatched_count: number
          updated_at: string
        }
        Insert: {
          active_section_found?: boolean
          created_at?: string
          id?: string
          import_batch_id?: string | null
          import_projection_status?: string | null
          import_record_ordinal?: number | null
          import_record_sha256?: string | null
          import_staged_record_id?: string | null
          inactive_section_found?: boolean
          locale?: string
          may_contain_section_found?: boolean
          parse_confidence?: number
          parse_status?: string
          parser_version?: string | null
          product_id: string
          raw_text: string
          review_status?: string
          source_id?: string | null
          source_snapshot_date?: string | null
          token_count?: number
          unmatched_count?: number
          updated_at?: string
        }
        Update: {
          active_section_found?: boolean
          created_at?: string
          id?: string
          import_batch_id?: string | null
          import_projection_status?: string | null
          import_record_ordinal?: number | null
          import_record_sha256?: string | null
          import_staged_record_id?: string | null
          inactive_section_found?: boolean
          locale?: string
          may_contain_section_found?: boolean
          parse_confidence?: number
          parse_status?: string
          parser_version?: string | null
          product_id?: string
          raw_text?: string
          review_status?: string
          source_id?: string | null
          source_snapshot_date?: string | null
          token_count?: number
          unmatched_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredient_lists_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "catalog_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_lists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_lists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_lists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_lists_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredient_tokens: {
        Row: {
          concentration_band: string | null
          created_at: string
          id: string
          ingredient_id: string | null
          ingredient_list_id: string
          is_unmatched: boolean
          match_confidence: number
          match_type: string
          normalized_token: string
          position: number
          product_id: string
          raw_token: string
          section: string
          source_id: string | null
          tags: string[]
        }
        Insert: {
          concentration_band?: string | null
          created_at?: string
          id?: string
          ingredient_id?: string | null
          ingredient_list_id: string
          is_unmatched?: boolean
          match_confidence?: number
          match_type?: string
          normalized_token: string
          position: number
          product_id: string
          raw_token: string
          section?: string
          source_id?: string | null
          tags?: string[]
        }
        Update: {
          concentration_band?: string | null
          created_at?: string
          id?: string
          ingredient_id?: string | null
          ingredient_list_id?: string
          is_unmatched?: boolean
          match_confidence?: number
          match_type?: string
          normalized_token?: string
          position?: number
          product_id?: string
          raw_token?: string
          section?: string
          source_id?: string | null
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredient_tokens_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_tokens_ingredient_list_id_fkey"
            columns: ["ingredient_list_id"]
            isOneToOne: false
            referencedRelation: "product_ingredient_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_tokens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_tokens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_tokens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredient_tokens_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          concentration_band: string | null
          created_at: string
          ingredient_id: string
          ingredient_list_id: string | null
          is_unmatched: boolean
          match_confidence: number | null
          match_type: string | null
          normalized_token: string | null
          parser_version: string | null
          position: number | null
          product_id: string
          raw_token: string | null
          source_id: string | null
        }
        Insert: {
          concentration_band?: string | null
          created_at?: string
          ingredient_id: string
          ingredient_list_id?: string | null
          is_unmatched?: boolean
          match_confidence?: number | null
          match_type?: string | null
          normalized_token?: string | null
          parser_version?: string | null
          position?: number | null
          product_id: string
          raw_token?: string | null
          source_id?: string | null
        }
        Update: {
          concentration_band?: string | null
          created_at?: string
          ingredient_id?: string
          ingredient_list_id?: string | null
          is_unmatched?: boolean
          match_confidence?: number | null
          match_type?: string | null
          normalized_token?: string | null
          parser_version?: string | null
          position?: number | null
          product_id?: string
          raw_token?: string | null
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_ingredient_list_id_fkey"
            columns: ["ingredient_list_id"]
            isOneToOne: false
            referencedRelation: "product_ingredient_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pao_expiry: {
        Row: {
          created_at: string
          evidence_note: string | null
          expiry_date: string | null
          expiry_source: string
          id: string
          pao_months: number | null
          pao_source: string
          product_id: string
          region: string
          review_status: string
          reviewed_by: string | null
          source_id: string | null
        }
        Insert: {
          created_at?: string
          evidence_note?: string | null
          expiry_date?: string | null
          expiry_source?: string
          id?: string
          pao_months?: number | null
          pao_source?: string
          product_id: string
          region?: string
          review_status?: string
          reviewed_by?: string | null
          source_id?: string | null
        }
        Update: {
          created_at?: string
          evidence_note?: string | null
          expiry_date?: string | null
          expiry_source?: string
          id?: string
          pao_months?: number | null
          pao_source?: string
          product_id?: string
          region?: string
          review_status?: string
          reviewed_by?: string | null
          source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pao_expiry_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pao_expiry_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pao_expiry_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_pao_expiry_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          barcode_quality_score: number
          brand: string | null
          brand_id: string | null
          canonical_name: string | null
          category: string | null
          category_id: string | null
          category_quality_score: number
          data_quality_score: number
          default_pao_months: number | null
          display_name: string | null
          formula_version: string | null
          id: string
          import_batch_id: string | null
          import_projection_status: string | null
          import_record_ordinal: number | null
          import_record_sha256: string | null
          import_staged_record_id: string | null
          imported_at: string
          ingredient_parse_confidence: number
          ingredient_parse_status: string
          ingredient_quality_score: number
          is_curated: boolean
          last_reviewed_at: string | null
          last_source_refresh_at: string | null
          name: string
          normalized_brand_name: string | null
          parser_version: string | null
          product_type: string | null
          quality_grade: string
          recommendation_eligible: boolean
          region: string
          replaces_product_id: string | null
          retired_import_natural_key: string | null
          review_status: string
          source: string
          source_id: string | null
          source_priority: number
          source_ref: string | null
          source_snapshot_date: string | null
          source_url: string | null
          status: string
          unresolved_correction_count: number
          variant_group_id: string | null
        }
        Insert: {
          barcode?: string | null
          barcode_quality_score?: number
          brand?: string | null
          brand_id?: string | null
          canonical_name?: string | null
          category?: string | null
          category_id?: string | null
          category_quality_score?: number
          data_quality_score?: number
          default_pao_months?: number | null
          display_name?: string | null
          formula_version?: string | null
          id?: string
          import_batch_id?: string | null
          import_projection_status?: string | null
          import_record_ordinal?: number | null
          import_record_sha256?: string | null
          import_staged_record_id?: string | null
          imported_at?: string
          ingredient_parse_confidence?: number
          ingredient_parse_status?: string
          ingredient_quality_score?: number
          is_curated?: boolean
          last_reviewed_at?: string | null
          last_source_refresh_at?: string | null
          name: string
          normalized_brand_name?: string | null
          parser_version?: string | null
          product_type?: string | null
          quality_grade?: string
          recommendation_eligible?: boolean
          region?: string
          replaces_product_id?: string | null
          retired_import_natural_key?: string | null
          review_status?: string
          source?: string
          source_id?: string | null
          source_priority?: number
          source_ref?: string | null
          source_snapshot_date?: string | null
          source_url?: string | null
          status?: string
          unresolved_correction_count?: number
          variant_group_id?: string | null
        }
        Update: {
          barcode?: string | null
          barcode_quality_score?: number
          brand?: string | null
          brand_id?: string | null
          canonical_name?: string | null
          category?: string | null
          category_id?: string | null
          category_quality_score?: number
          data_quality_score?: number
          default_pao_months?: number | null
          display_name?: string | null
          formula_version?: string | null
          id?: string
          import_batch_id?: string | null
          import_projection_status?: string | null
          import_record_ordinal?: number | null
          import_record_sha256?: string | null
          import_staged_record_id?: string | null
          imported_at?: string
          ingredient_parse_confidence?: number
          ingredient_parse_status?: string
          ingredient_quality_score?: number
          is_curated?: boolean
          last_reviewed_at?: string | null
          last_source_refresh_at?: string | null
          name?: string
          normalized_brand_name?: string | null
          parser_version?: string | null
          product_type?: string | null
          quality_grade?: string
          recommendation_eligible?: boolean
          region?: string
          replaces_product_id?: string | null
          retired_import_natural_key?: string | null
          review_status?: string
          source?: string
          source_id?: string | null
          source_priority?: number
          source_ref?: string | null
          source_snapshot_date?: string | null
          source_url?: string | null
          status?: string
          unresolved_correction_count?: number
          variant_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "catalog_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_replaces_product_id_fkey"
            columns: ["replaces_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_replaces_product_id_fkey"
            columns: ["replaces_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_replaces_product_id_fkey"
            columns: ["replaces_product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          adherence_timezone: string | null
          avatar_path: string | null
          created_at: string
          current_streak: number
          display_name: string | null
          id: string
          locale: string | null
          longest_streak: number
          streak_algorithm_version: number
          streak_reference_day: string | null
          units: string
          updated_at: string
        }
        Insert: {
          adherence_timezone?: string | null
          avatar_path?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          id: string
          locale?: string | null
          longest_streak?: number
          streak_algorithm_version?: number
          streak_reference_day?: string | null
          units?: string
          updated_at?: string
        }
        Update: {
          adherence_timezone?: string | null
          avatar_path?: string | null
          created_at?: string
          current_streak?: number
          display_name?: string | null
          id?: string
          locale?: string | null
          longest_streak?: number
          streak_algorithm_version?: number
          streak_reference_day?: string | null
          units?: string
          updated_at?: string
        }
        Relationships: []
      }
      recommendation_preferences: {
        Row: {
          budget_band: string | null
          format_prefs: string[]
          updated_at: string
          user_id: string
          values_filters: string[]
        }
        Insert: {
          budget_band?: string | null
          format_prefs?: string[]
          updated_at?: string
          user_id: string
          values_filters?: string[]
        }
        Update: {
          budget_band?: string | null
          format_prefs?: string[]
          updated_at?: string
          user_id?: string
          values_filters?: string[]
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          catalog_product_id: string | null
          created_at: string
          evidence_grade: string | null
          fit_rationale: string
          id: string
          product_type: string
          status: string
          trigger: string
          user_id: string
        }
        Insert: {
          catalog_product_id?: string | null
          created_at?: string
          evidence_grade?: string | null
          fit_rationale: string
          id?: string
          product_type: string
          status?: string
          trigger: string
          user_id: string
        }
        Update: {
          catalog_product_id?: string | null
          created_at?: string
          evidence_grade?: string | null
          fit_rationale?: string
          id?: string
          product_type?: string
          status?: string
          trigger?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      revenuecat_identity_tombstones: {
        Row: {
          created_at: string
          expires_at: string
          hmac_key_version: number
          identity_hmac: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          hmac_key_version: number
          identity_hmac: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          hmac_key_version?: number
          identity_hmac?: string
        }
        Relationships: []
      }
      reverse_trial_grants: {
        Row: {
          expires_at: string
          granted_at: string
          metadata: Json
          source: string
          user_id: string
        }
        Insert: {
          expires_at: string
          granted_at?: string
          metadata?: Json
          source?: string
          user_id: string
        }
        Update: {
          expires_at?: string
          granted_at?: string
          metadata?: Json
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      routine_completions: {
        Row: {
          completed_at: string
          completed_date: string
          created_at: string
          id: string
          routine_id: string
          source: string
          step_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string
          completed_date: string
          created_at?: string
          id?: string
          routine_id: string
          source?: string
          step_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string
          completed_date?: string
          created_at?: string
          id?: string
          routine_id?: string
          source?: string
          step_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_completions_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_completions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "routine_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_conflicts: {
        Row: {
          computed_severity: string
          created_at: string
          id: string
          product_a_id: string | null
          product_b_id: string | null
          rule_id: string
          rule_version: number | null
          status: string
          updated_at: string
          user_choice: string | null
          user_id: string
        }
        Insert: {
          computed_severity: string
          created_at?: string
          id?: string
          product_a_id?: string | null
          product_b_id?: string | null
          rule_id: string
          rule_version?: number | null
          status?: string
          updated_at?: string
          user_choice?: string | null
          user_id: string
        }
        Update: {
          computed_severity?: string
          created_at?: string
          id?: string
          product_a_id?: string | null
          product_b_id?: string | null
          rule_id?: string
          rule_version?: number | null
          status?: string
          updated_at?: string
          user_choice?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_conflicts_product_a_id_fkey"
            columns: ["product_a_id"]
            isOneToOne: false
            referencedRelation: "user_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_conflicts_product_b_id_fkey"
            columns: ["product_b_id"]
            isOneToOne: false
            referencedRelation: "user_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_conflicts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "conflict_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_steps: {
        Row: {
          created_at: string
          cycling_night: number | null
          frequency: string
          id: string
          instructions: string | null
          routine_id: string
          step_order: number
          user_product_id: string | null
        }
        Insert: {
          created_at?: string
          cycling_night?: number | null
          frequency?: string
          id?: string
          instructions?: string | null
          routine_id: string
          step_order: number
          user_product_id?: string | null
        }
        Update: {
          created_at?: string
          cycling_night?: number | null
          frequency?: string
          id?: string
          instructions?: string | null
          routine_id?: string
          step_order?: number
          user_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_steps_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_steps_user_product_id_fkey"
            columns: ["user_product_id"]
            isOneToOne: false
            referencedRelation: "shelf_product_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sequencing_rules: {
        Row: {
          am_eligible: boolean
          base_priority: number
          default_phase: string
          id: string
          is_active: boolean
          notes: string | null
          pm_eligible: boolean
          reviewed_by: string | null
          role: string
          rule_version: number
        }
        Insert: {
          am_eligible?: boolean
          base_priority: number
          default_phase?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          pm_eligible?: boolean
          reviewed_by?: string | null
          role: string
          rule_version?: number
        }
        Update: {
          am_eligible?: boolean
          base_priority?: number
          default_phase?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          pm_eligible?: boolean
          reviewed_by?: string | null
          role?: string
          rule_version?: number
        }
        Relationships: []
      }
      shelf_product_identities: {
        Row: {
          created_at: string
          deleted_effective_at: string | null
          deleted_received_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_effective_at?: string | null
          deleted_received_at?: string | null
          id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_effective_at?: string | null
          deleted_received_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      shelf_scans: {
        Row: {
          barcode: string | null
          contributed_back: boolean
          created_at: string
          id: string
          matched_product_id: string | null
          result: string
          user_id: string
        }
        Insert: {
          barcode?: string | null
          contributed_back?: boolean
          created_at?: string
          id?: string
          matched_product_id?: string | null
          result: string
          user_id: string
        }
        Update: {
          barcode?: string | null
          contributed_back?: boolean
          created_at?: string
          id?: string
          matched_product_id?: string | null
          result?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelf_scans_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_scans_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_scans_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
        ]
      }
      skin_profiles: {
        Row: {
          completed_at: string | null
          created_at: string
          dspt: string | null
          fitzpatrick: number | null
          goals: string[]
          id: string
          monk_tone: number | null
          oily_dry: number | null
          oily_dry_basis_points: number | null
          pigmented_non: number | null
          pigmented_non_basis_points: number | null
          pregnancy_status: string | null
          quiz_content_sha256: string | null
          quiz_content_version: string | null
          quiz_contract_id: string | null
          quiz_contract_sha256: string | null
          quiz_output_schema_version: number | null
          quiz_pole_tie_rule: string | null
          quiz_review_status: string | null
          quiz_scoring_sha256: string | null
          quiz_scoring_version: string | null
          sensitive_resistant: number | null
          sensitive_resistant_basis_points: number | null
          sensitivities: string[]
          user_id: string
          version: number
          wrinkled_tight: number | null
          wrinkled_tight_basis_points: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dspt?: string | null
          fitzpatrick?: number | null
          goals?: string[]
          id?: string
          monk_tone?: number | null
          oily_dry?: number | null
          oily_dry_basis_points?: number | null
          pigmented_non?: number | null
          pigmented_non_basis_points?: number | null
          pregnancy_status?: string | null
          quiz_content_sha256?: string | null
          quiz_content_version?: string | null
          quiz_contract_id?: string | null
          quiz_contract_sha256?: string | null
          quiz_output_schema_version?: number | null
          quiz_pole_tie_rule?: string | null
          quiz_review_status?: string | null
          quiz_scoring_sha256?: string | null
          quiz_scoring_version?: string | null
          sensitive_resistant?: number | null
          sensitive_resistant_basis_points?: number | null
          sensitivities?: string[]
          user_id: string
          version?: number
          wrinkled_tight?: number | null
          wrinkled_tight_basis_points?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dspt?: string | null
          fitzpatrick?: number | null
          goals?: string[]
          id?: string
          monk_tone?: number | null
          oily_dry?: number | null
          oily_dry_basis_points?: number | null
          pigmented_non?: number | null
          pigmented_non_basis_points?: number | null
          pregnancy_status?: string | null
          quiz_content_sha256?: string | null
          quiz_content_version?: string | null
          quiz_contract_id?: string | null
          quiz_contract_sha256?: string | null
          quiz_output_schema_version?: number | null
          quiz_pole_tie_rule?: string | null
          quiz_review_status?: string | null
          quiz_scoring_sha256?: string | null
          quiz_scoring_version?: string | null
          sensitive_resistant?: number | null
          sensitive_resistant_basis_points?: number | null
          sensitivities?: string[]
          user_id?: string
          version?: number
          wrinkled_tight?: number | null
          wrinkled_tight_basis_points?: number | null
        }
        Relationships: []
      }
      streak_freezes: {
        Row: {
          applied_for_date: string
          created_at: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          applied_for_date: string
          created_at?: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          applied_for_date?: string
          created_at?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions_events: {
        Row: {
          aliases: string[] | null
          app_user_id: string | null
          auth_verified: boolean | null
          environment: string | null
          error: string | null
          event_type: string | null
          id: string
          original_app_user_id: string | null
          original_transaction_id: string | null
          payload: Json | null
          processed_at: string | null
          processing_attempts: number
          processing_status: string | null
          product_id: string | null
          projection_applied: boolean
          projection_priority: number | null
          provider_event_at: string | null
          rc_event_id: string | null
          received_at: string
          resolved_user_id: string | null
          signature_verified: boolean | null
          store: string | null
          transaction_id: string | null
          transferred_from: string[] | null
          transferred_to: string[] | null
          user_id: string | null
        }
        Insert: {
          aliases?: string[] | null
          app_user_id?: string | null
          auth_verified?: boolean | null
          environment?: string | null
          error?: string | null
          event_type?: string | null
          id?: string
          original_app_user_id?: string | null
          original_transaction_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          processing_attempts?: number
          processing_status?: string | null
          product_id?: string | null
          projection_applied?: boolean
          projection_priority?: number | null
          provider_event_at?: string | null
          rc_event_id?: string | null
          received_at?: string
          resolved_user_id?: string | null
          signature_verified?: boolean | null
          store?: string | null
          transaction_id?: string | null
          transferred_from?: string[] | null
          transferred_to?: string[] | null
          user_id?: string | null
        }
        Update: {
          aliases?: string[] | null
          app_user_id?: string | null
          auth_verified?: boolean | null
          environment?: string | null
          error?: string | null
          event_type?: string | null
          id?: string
          original_app_user_id?: string | null
          original_transaction_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          processing_attempts?: number
          processing_status?: string | null
          product_id?: string | null
          projection_applied?: boolean
          projection_priority?: number | null
          provider_event_at?: string | null
          rc_event_id?: string | null
          received_at?: string
          resolved_user_id?: string | null
          signature_verified?: boolean | null
          store?: string | null
          transaction_id?: string | null
          transferred_from?: string[] | null
          transferred_to?: string[] | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_products: {
        Row: {
          added_via: string | null
          barcode: string | null
          catalog_match_quality: string | null
          catalog_pao_evidence_id: string | null
          catalog_pao_recorded_at: string | null
          catalog_pao_region: string | null
          catalog_pao_source_id: string | null
          catalog_product_id: string | null
          catalog_source_id: string | null
          catalog_source_snapshot_date: string | null
          created_at: string
          discard_after: string | null
          discard_basis: string | null
          expiry_computed: string | null
          expiry_date: string | null
          expiry_source: string
          finished_at: string | null
          id: string
          is_opened: boolean
          legacy_unverified_expiry_date: string | null
          manual_brand: string | null
          manual_name: string | null
          nickname: string | null
          notes: string | null
          opened_at: string | null
          pao_months: number | null
          pao_source: string
          routine_slot: string | null
          source_disclosure_ack_at: string | null
          status: string
          thumbnail_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          added_via?: string | null
          barcode?: string | null
          catalog_match_quality?: string | null
          catalog_pao_evidence_id?: string | null
          catalog_pao_recorded_at?: string | null
          catalog_pao_region?: string | null
          catalog_pao_source_id?: string | null
          catalog_product_id?: string | null
          catalog_source_id?: string | null
          catalog_source_snapshot_date?: string | null
          created_at?: string
          discard_after?: string | null
          discard_basis?: string | null
          expiry_computed?: string | null
          expiry_date?: string | null
          expiry_source?: string
          finished_at?: string | null
          id?: string
          is_opened?: boolean
          legacy_unverified_expiry_date?: string | null
          manual_brand?: string | null
          manual_name?: string | null
          nickname?: string | null
          notes?: string | null
          opened_at?: string | null
          pao_months?: number | null
          pao_source?: string
          routine_slot?: string | null
          source_disclosure_ack_at?: string | null
          status?: string
          thumbnail_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          added_via?: string | null
          barcode?: string | null
          catalog_match_quality?: string | null
          catalog_pao_evidence_id?: string | null
          catalog_pao_recorded_at?: string | null
          catalog_pao_region?: string | null
          catalog_pao_source_id?: string | null
          catalog_product_id?: string | null
          catalog_source_id?: string | null
          catalog_source_snapshot_date?: string | null
          created_at?: string
          discard_after?: string | null
          discard_basis?: string | null
          expiry_computed?: string | null
          expiry_date?: string | null
          expiry_source?: string
          finished_at?: string | null
          id?: string
          is_opened?: boolean
          legacy_unverified_expiry_date?: string | null
          manual_brand?: string | null
          manual_name?: string | null
          nickname?: string | null
          notes?: string | null
          opened_at?: string | null
          pao_months?: number | null
          pao_source?: string
          routine_slot?: string | null
          source_disclosure_ack_at?: string | null
          status?: string
          thumbnail_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_products_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "catalog_servable_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_products_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_products_catalog_product_id_fkey"
            columns: ["catalog_product_id"]
            isOneToOne: false
            referencedRelation: "recommendable_catalog_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_products_catalog_source_id_fkey"
            columns: ["catalog_source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_products_shelf_identity_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "shelf_product_identities"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_signups: {
        Row: {
          attribution: Json
          created_at: string
          email: string
          id: string
          source: string
        }
        Insert: {
          attribution?: Json
          created_at?: string
          email: string
          id?: string
          source?: string
        }
        Update: {
          attribution?: Json
          created_at?: string
          email?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      catalog_servable_products: {
        Row: {
          barcode: string | null
          brand: string | null
          catalog_source_id: string | null
          catalog_sources: Json | null
          category: string | null
          data_quality_score: number | null
          default_pao_months: number | null
          id: string | null
          ingredient_parse_confidence: number | null
          ingredient_parse_status: string | null
          name: string | null
          product_pao_expiry: Json | null
          quality_grade: string | null
          region: string | null
          review_status: string | null
          source: string | null
          source_ref: string | null
          source_snapshot_date: string | null
          source_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_source_id_fkey"
            columns: ["catalog_source_id"]
            isOneToOne: false
            referencedRelation: "catalog_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendable_catalog_products: {
        Row: {
          brand: string | null
          category: string | null
          data_quality_score: number | null
          id: string | null
          ingredient_quality_score: number | null
          name: string | null
          product_type: string | null
          quality_grade: string | null
          region: string | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          data_quality_score?: number | null
          id?: string | null
          ingredient_quality_score?: number | null
          name?: string | null
          product_type?: string | null
          quality_grade?: string | null
          region?: string | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          data_quality_score?: number | null
          id?: string | null
          ingredient_quality_score?: number | null
          name?: string | null
          product_type?: string | null
          quality_grade?: string | null
          region?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _account_access_allowed: { Args: { p_user_id: string }; Returns: boolean }
      _account_deletion_advisory_key: {
        Args: { p_user_id: string }
        Returns: number
      }
      _account_deletion_capability_digest: {
        Args: { p_capability: string }
        Returns: string
      }
      _account_deletion_claim_digest: {
        Args: { p_claim_token: string }
        Returns: string
      }
      _account_deletion_claimable_step: {
        Args: { p_claim_mode: string; p_now: string; p_operation_id: string }
        Returns: {
          step_name: string
        }[]
      }
      _account_deletion_idempotency_digest: {
        Args: { p_idempotency_key: string }
        Returns: string
      }
      _account_deletion_operator_command_digest: {
        Args: { p_command_token: string }
        Returns: string
      }
      _account_deletion_token_digest: {
        Args: { p_context: string; p_token: string }
        Returns: string
      }
      _account_photo_storage_object_owned: {
        Args: {
          p_object_name: string
          p_owner: string
          p_owner_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      _account_publication_capability_digest: {
        Args: { p_capability: string }
        Returns: string
      }
      _apple_auth_claim_digest: {
        Args: { p_claim_token: string }
        Returns: string
      }
      _apple_auth_has_identity: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      _apple_auth_identity_matches: {
        Args: { p_apple_subject: string; p_user_id: string }
        Returns: boolean
      }
      _apple_auth_next_validation_at: {
        Args: { p_generation: number; p_now: string; p_user_id: string }
        Returns: string
      }
      _assert_account_publication_fence_installable: {
        Args: never
        Returns: undefined
      }
      _assert_current_health_session: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      _assert_health_consent_capability_cleared: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      _assert_health_consent_copy: {
        Args: {
          p_action: string
          p_consent_text_hash: string
          p_version: string
        }
        Returns: undefined
      }
      _assert_health_consent_copy_for_type: {
        Args: {
          p_action: string
          p_consent_text_hash: string
          p_consent_type: string
          p_version: string
        }
        Returns: undefined
      }
      _assert_health_dependent_active_locked: {
        Args: { p_consent_type: string; p_user_id: string }
        Returns: undefined
      }
      _assert_health_dependent_generation_locked: {
        Args: {
          p_consent_type: string
          p_expected_epoch: number
          p_expected_generation: number
          p_user_id: string
        }
        Returns: undefined
      }
      _assert_health_processing_active_locked: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      _assert_health_processing_epoch_locked: {
        Args: { p_expected_epoch: number; p_user_id: string }
        Returns: undefined
      }
      _assert_health_withdrawal_claim_locked: {
        Args: { p_claim_token: string; p_operation_id: string }
        Returns: undefined
      }
      _begin_account_deletion_v0048_unbound: {
        Args: {
          p_apple_encrypted_credential: string
          p_capability: string
          p_idempotency_key: string
          p_operation_expires_at: string
          p_posthog_encrypted_reconciliation: string
          p_revenuecat_encrypted_reconciliation: string
          p_user_id: string
        }
        Returns: {
          created: boolean
          operation_expires_at: string
          operation_id: string
          operation_state: string
        }[]
      }
      _consume_edge_rate_limit_v0048_unbound: {
        Args: {
          p_key_hash: string
          p_limit: number
          p_owner_user_id: string
          p_scope: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      _ensure_health_dependent_consent_states: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      _establish_revenuecat_deletion_identity_barrier_v0051_locked: {
        Args: {
          p_claim_token: string
          p_expires_at: string
          p_identity_hmac_key_version: number
          p_identity_hmacs: string[]
          p_operation_id: string
          p_raw_identities: string[]
        }
        Returns: {
          established: boolean
          identity_count: number
          tombstone_version: number
        }[]
      }
      _get_account_deletion_barrier_state_v0048_unbound: {
        Args: { p_user_id: string }
        Returns: string
      }
      _health_consent_copy_staging_evidence_hash: {
        Args: {
          p_action: string
          p_consent_type: string
          p_previous_consent_text_hash: string
          p_previous_version: string
          p_staged_by: string
          p_staging_change_reference: string
          p_successor_consent_text_hash: string
          p_successor_version: string
        }
        Returns: string
      }
      _health_consent_token_digest: {
        Args: { p_token: string }
        Returns: string
      }
      _health_consent_type_protected: {
        Args: { p_consent_type: string }
        Returns: boolean
      }
      _health_dependent_residual_exists: {
        Args: { p_consent_type: string; p_user_id: string }
        Returns: boolean
      }
      _health_photo_path_belongs_to_epoch: {
        Args: { p_epoch: number; p_storage_path: string; p_user_id: string }
        Returns: boolean
      }
      _health_photo_path_belongs_to_user: {
        Args: { p_storage_path: string; p_user_id: string }
        Returns: boolean
      }
      _health_photo_path_safe_for_withdrawal: {
        Args: { p_epoch: number; p_storage_path: string; p_user_id: string }
        Returns: boolean
      }
      _health_purge_context_active: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      _health_purpose_data_exists: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      _health_read_barrier_context_active: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      _health_relational_data_exists: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      _issue_health_consent_receipt_capability: {
        Args: {
          p_action: string
          p_consent_text_hash: string
          p_consent_type: string
          p_granted: boolean
          p_scope: string
          p_user_id: string
          p_version: string
        }
        Returns: undefined
      }
      _queue_account_deletion_from_apple_event: {
        Args: { p_now: string; p_user_id: string }
        Returns: string
      }
      _read_entitlement_projections_v0053_unfenced: {
        Args: never
        Returns: Json
      }
      _refresh_account_deletion_operation: {
        Args: { p_now: string; p_operation_id: string }
        Returns: undefined
      }
      _refresh_account_publication_leases: {
        Args: { p_now: string; p_user_id: string }
        Returns: undefined
      }
      _request_health_dependent_generation: {
        Args: { p_expected_consent_type: string }
        Returns: number
      }
      _request_health_processing_epoch: { Args: never; Returns: number }
      _revenuecat_embedded_account_uuids: {
        Args: { p_value: string }
        Returns: string[]
      }
      _revenuecat_event_cursor_is_newer_v0053: {
        Args: {
          p_new_at: string
          p_new_event_id: string
          p_new_priority: number
          p_old_at: string
          p_old_event_id: string
          p_old_priority: number
        }
        Returns: boolean
      }
      _revenuecat_exact_account_uuid: {
        Args: { p_value: string }
        Returns: string
      }
      _revenuecat_filter_identity_array: {
        Args: {
          p_active_account_ids: string[]
          p_inactive_account_ids: string[]
          p_values: string[]
        }
        Returns: string[]
      }
      _revenuecat_filter_identity_array_v0051: {
        Args: {
          p_active_account_ids: string[]
          p_inactive_account_ids: string[]
          p_tombstoned_values: string[]
          p_values: string[]
        }
        Returns: string[]
      }
      _revenuecat_filter_identity_scalar: {
        Args: {
          p_active_account_ids: string[]
          p_inactive_account_ids: string[]
          p_value: string
        }
        Returns: string
      }
      _revenuecat_filter_identity_scalar_v0051: {
        Args: {
          p_active_account_ids: string[]
          p_inactive_account_ids: string[]
          p_tombstoned_values: string[]
          p_value: string
        }
        Returns: string
      }
      _revenuecat_identity_contains_account_uuid: {
        Args: { p_account_ids: string[]; p_value: string }
        Returns: boolean
      }
      _revenuecat_identity_matches_family_v0051: {
        Args: { p_raw_identities: string[]; p_user_id: string; p_value: string }
        Returns: boolean
      }
      _revenuecat_identity_tombstone_advisory_key: {
        Args: { p_hmac_key_version: number; p_identity_hmac: string }
        Returns: number
      }
      _revenuecat_remove_identity_family_v0051: {
        Args: {
          p_raw_identities: string[]
          p_user_id: string
          p_values: string[]
        }
        Returns: string[]
      }
      _scrub_account_service_rows_unlocked_0048: {
        Args: { p_user_id: string }
        Returns: Json
      }
      _scrub_account_service_rows_v0046_unlocked: {
        Args: { p_user_id: string }
        Returns: Json
      }
      _settle_account_publication_drain: {
        Args: { p_now: string; p_user_id: string }
        Returns: boolean
      }
      account_access_allowed: { Args: never; Returns: boolean }
      account_write_allowed:
        | { Args: never; Returns: boolean }
        | { Args: { p_user_id: string }; Returns: boolean }
      activate_account_publication_lease: {
        Args: { p_capability: string; p_session_id: string; p_user_id: string }
        Returns: {
          status: string
        }[]
      }
      activate_catalog_launch_curation: {
        Args: {
          p_actor: string
          p_curation_record_id: string
          p_expected_activation_signature_sha256: string
          p_expected_curation_record_sha256: string
          p_expected_database_activation_request_sha256: string
          p_operation_key: string
          p_reason: string
        }
        Returns: {
          activation_signature_sha256: string
          campaign_authority_sha256: string
          cat02_database_normalized_record_sha256: string
          cat02_database_observation_sha256: string
          cat02_membership_proof_sha256: string
          cat02_membership_readback_sha256: string
          cat02_production_integrity_set_sha256: string
          cat02_stage_record_sha256: string
          cat02_verifier_signature_set_sha256: string
          curation_event_id: string
          curation_outcome_reviewer_signature_set_sha256: string
          curation_record_sha256: string
          database_activation_request_sha256: string
          database_base_record_sha256: string
          dependency_memberships: Json
          event_receipt_sha256: string
          head_generation: number
          head_sha256: string
          offline_base_sealed_record_sha256: string
          product_id: string
          product_record_sha256: string
          regulatory_review_evidence_sha256: string
          regulatory_reviewer_ids: string[]
          regulatory_signature_set_sha256: string
          release_id: string
          replayed: boolean
          reviewed_record_mapping_sha256: string
          reviewer_evidence_sha256s: string[]
          reviewer_signature_set_sha256: string
          served_state_mutation_root_sha256: string
          source_approval_sha256: string
          source_qa_sha256: string
        }[]
      }
      apply_apple_auth_server_event: {
        Args: {
          p_apple_subject: string
          p_apple_subject_hmacs: string[]
          p_client_id: string
          p_event_at: string
          p_event_type: string
          p_jti_hmac: string
          p_payload_hmac: string
          p_relay_email_hmac: string
          p_subject_hmac_key_versions: string[]
        }
        Returns: {
          generation: number
          result_code: string
          state: string
          user_id: string
        }[]
      }
      begin_account_deletion: {
        Args: {
          p_apple_encrypted_credential: string
          p_capability: string
          p_idempotency_key: string
          p_operation_expires_at: string
          p_posthog_encrypted_reconciliation: string
          p_revenuecat_encrypted_reconciliation: string
          p_session_id: string
          p_user_id: string
        }
        Returns: {
          created: boolean
          operation_expires_at: string
          operation_id: string
          operation_state: string
        }[]
      }
      begin_apple_auth_capture: {
        Args: {
          p_apple_subject: string
          p_apple_subject_hmacs: string[]
          p_client_id: string
          p_code_hmac: string
          p_operation_id: string
          p_session_id: string
          p_subject_hmac_key_versions: string[]
          p_user_id: string
        }
        Returns: string
      }
      begin_catalog_import: {
        Args: {
          p_artifact_kind: string
          p_artifact_sha256: string
          p_artifact_uri: string
          p_batch_type: string
          p_expected_record_count: number
          p_manifest: Json
          p_manifest_sha256: string
          p_operation_key: string
          p_parser_version: string
          p_qa_blocker_count: number
          p_qa_report_sha256: string
          p_qa_report_uri: string
          p_qa_warning_count: number
          p_snapshot_date: string
          p_source_approval_sha256: string
          p_source_key: string
          p_source_policy_sha256: string
          p_territory: string
          p_transform_sha256: string
          p_transformed_payload_sha256: string
        }
        Returns: {
          batch_id: string
          batch_status: string
          replayed: boolean
        }[]
      }
      begin_health_data_consent_withdrawal: {
        Args: {
          p_consent_text_hash: string
          p_expected_epoch: number
          p_idempotency_key: string
          p_version: string
        }
        Returns: {
          consent_text_hash: string
          consent_version: string
          epoch: number
          operation_id: string
          operation_state: string
          result_code: string
          server_verified_at: string
          state: string
          user_id: string
        }[]
      }
      begin_health_dependent_consent_withdrawal: {
        Args: {
          p_consent_text_hash: string
          p_consent_type: string
          p_expected_epoch: number
          p_expected_generation: number
          p_idempotency_key: string
          p_version: string
        }
        Returns: {
          consent_generation: number
          consent_type: string
          operation_id: string
          processing_epoch: number
          state: string
          user_id: string
        }[]
      }
      canonical_subscription_owner_identity: {
        Args: { p_value: string }
        Returns: string
      }
      claim_account_deletion_step: {
        Args: {
          p_claim_mode: string
          p_lease_seconds: number
          p_operation_id: string
        }
        Returns: {
          attempt_count: number
          claim_mode: string
          claim_token: string
          claimed: boolean
          encrypted_payload: string
          lease_expires_at: string
          operation_state: string
          request_started_at: string
          step_name: string
          step_status: string
        }[]
      }
      claim_due_apple_auth_validations: {
        Args: { p_claim_token: string; p_limit: number }
        Returns: {
          apple_subject_hmac: string
          client_id: string
          encrypted_refresh_token: string
          generation: number
          last_validated_at: string
          subject_hmac_key_version: string
          user_id: string
          vault_key_version: string
        }[]
      }
      claim_due_health_consent_withdrawals: {
        Args: { p_claim_token: string; p_limit?: number }
        Returns: {
          epoch: number
          operation_id: string
          user_id: string
        }[]
      }
      claim_due_health_dependent_consent_withdrawals: {
        Args: { p_claim_token: string; p_limit?: number }
        Returns: {
          consent_generation: number
          consent_type: string
          operation_id: string
          processing_epoch: number
          user_id: string
        }[]
      }
      claim_health_consent_withdrawal_for_owner: {
        Args: {
          p_claim_token: string
          p_operation_id: string
          p_user_id: string
        }
        Returns: {
          epoch: number
          operation_id: string
          user_id: string
        }[]
      }
      claim_next_account_deletion_step: {
        Args: { p_claim_mode: string; p_lease_seconds: number }
        Returns: {
          attempt_count: number
          claim_mode: string
          claim_token: string
          encrypted_payload: string
          lease_expires_at: string
          operation_id: string
          operation_state: string
          request_started_at: string
          step_name: string
          step_status: string
          user_id: string
        }[]
      }
      close_health_consent_copy_for_emergency: {
        Args: {
          p_action: string
          p_consent_text_hash: string
          p_consent_type: string
          p_review_evidence_hash: string
          p_review_ticket: string
          p_reviewed_by: string
          p_version: string
        }
        Returns: {
          action: string
          consent_text_hash: string
          consent_type: string
          is_current: boolean
          lifecycle_event_id: string
          review_evidence_hash: string
          review_status: string
          review_ticket: string
          reviewed_at: string
          reviewed_by: string
          version: string
        }[]
      }
      complete_apple_auth_capture: {
        Args: {
          p_encrypted_refresh_token: string
          p_operation_id: string
          p_session_id: string
          p_user_id: string
          p_vault_key_version: string
        }
        Returns: {
          generation: number
          next_validation_at: string
          state: string
        }[]
      }
      complete_apple_auth_validation: {
        Args: {
          p_apple_subject_hmac: string
          p_claim_token: string
          p_encrypted_refresh_token: string
          p_generation: number
          p_subject_hmac_key_version: string
          p_user_id: string
          p_vault_key_version: string
        }
        Returns: boolean
      }
      complete_health_data_consent_withdrawal: {
        Args: { p_claim_token: string; p_operation_id: string }
        Returns: {
          consent_text_hash: string
          consent_version: string
          epoch: number
          operation_id: string
          operation_state: string
          result_code: string
          server_verified_at: string
          state: string
          user_id: string
        }[]
      }
      complete_health_dependent_consent_withdrawal: {
        Args: { p_operation_id: string }
        Returns: {
          consent_generation: number
          consent_type: string
          operation_id: string
          processing_epoch: number
          state: string
          user_id: string
        }[]
      }
      consume_edge_rate_limit:
        | {
            Args: {
              p_key_hash: string
              p_limit: number
              p_scope: string
              p_window_seconds: number
            }
            Returns: boolean
          }
        | {
            Args: {
              p_key_hash: string
              p_limit: number
              p_owner_user_id: string
              p_scope: string
              p_window_seconds: number
            }
            Returns: boolean
          }
        | {
            Args: {
              p_key_hash: string
              p_limit: number
              p_owner_user_id: string
              p_scope: string
              p_session_id: string
              p_window_seconds: number
            }
            Returns: boolean
          }
      consume_revenuecat_account_deletion_budget: {
        Args: { p_domain: string; p_key_hash: string }
        Returns: boolean
      }
      count_account_photo_storage_objects: {
        Args: { p_user_id: string }
        Returns: number
      }
      decline_initial_health_data_consent: {
        Args: {
          p_consent_text_hash: string
          p_expected_epoch: number
          p_version: string
        }
        Returns: {
          consent_text_hash: string
          consent_version: string
          epoch: number
          operation_id: string
          operation_state: string
          result_code: string
          server_verified_at: string
          state: string
          user_id: string
        }[]
      }
      defer_account_deletion_revenuecat_provider_capacity: {
        Args: {
          p_claim_token: string
          p_operation_id: string
          p_retry_at: string
          p_step_name: string
        }
        Returns: {
          deferred: boolean
          next_attempt_at: string
        }[]
      }
      defer_apple_auth_validation: {
        Args: {
          p_claim_token: string
          p_failure_code: string
          p_generation: number
          p_retry_after_seconds: number
          p_user_id: string
        }
        Returns: string
      }
      defer_health_consent_withdrawal: {
        Args: {
          p_claim_token: string
          p_operation_id: string
          p_result_code: string
          p_retry_after_seconds: number
        }
        Returns: {
          next_attempt_at: string
          operation_id: string
          operation_state: string
          result_code: string
        }[]
      }
      defer_health_dependent_consent_withdrawal: {
        Args: {
          p_claim_token: string
          p_operation_id: string
          p_result_code: string
          p_retry_after_seconds?: number
        }
        Returns: {
          next_attempt_at: string
          operation_id: string
          result_code: string
          state: string
        }[]
      }
      enqueue_obf_contribution_for_correction: {
        Args: { p_correction_id: string }
        Returns: Json
      }
      establish_revenuecat_deletion_identity_barrier: {
        Args: {
          p_claim_token: string
          p_expires_at: string
          p_identity_hmac_key_version: number
          p_identity_hmacs: string[]
          p_operation_id: string
          p_raw_identities: string[]
        }
        Returns: {
          established: boolean
          identity_count: number
          tombstone_version: number
        }[]
      }
      expire_app_granted_reverse_trials: { Args: never; Returns: number }
      export_catalog_corrections_for_subject: {
        Args: {
          p_after_created_at: string
          p_after_id: string
          p_limit: number
          p_user_id: string
        }
        Returns: {
          barcode: string
          client_context: Json
          correction_type: string
          created_at: string
          description: string
          export_total_count: number
          id: string
          product_id: string
          proposed_payload: Json
          source_id: string
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      export_routine_completion_sync_receipts_for_subject: {
        Args: {
          p_after_created_at: string
          p_after_id: string
          p_limit: number
        }
        Returns: {
          created_at: string
          event_id: string
          export_total_count: number
          finalized_at: string
          result_code: string
          state: string
          user_id: string
        }[]
      }
      export_shelf_product_identities_for_subject: {
        Args: {
          p_after_created_at: string
          p_after_id: string
          p_limit: number
        }
        Returns: {
          created_at: string
          deleted_effective_at: string
          deleted_received_at: string
          export_total_count: number
          id: string
          user_id: string
        }[]
      }
      export_shelf_sync_receipts_for_subject: {
        Args: {
          p_after_created_at: string
          p_after_id: string
          p_limit: number
        }
        Returns: {
          created_at: string
          export_total_count: number
          finalized_at: string
          operation_id: string
          result_code: string
          state: string
          user_id: string
        }[]
      }
      fail_apple_auth_capture: {
        Args: {
          p_failure_code: string
          p_operation_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      finalize_account_deletion: {
        Args: {
          p_operation_id: string
          p_receipt_expires_at: string
          p_subject_hmac: string
          p_subject_hmac_key_version: number
        }
        Returns: {
          apple_manual_revocation_required: boolean
          completed: boolean
          completed_at: string
          expires_at: string
        }[]
      }
      finalize_catalog_import: {
        Args: {
          p_batch_id: string
          p_expected_record_count: number
          p_operation_key: string
        }
        Returns: {
          batch_id: string
          batch_status: string
          candidates_sha256: string
          canonical_record_count: number
          conflict_record_count: number
          duplicate_record_count: number
          record_receipts: Json
          records_sha256: string
          replayed: boolean
        }[]
      }
      get_account_access_state: {
        Args: never
        Returns: {
          generation: number
          state: string
          user_id: string
        }[]
      }
      get_account_deletion_barrier_state: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: string
      }
      get_account_deletion_receipt: {
        Args: { p_subject_hmac: string; p_subject_hmac_key_version: number }
        Returns: {
          apple_manual_revocation_required: boolean
          completed: boolean
          completed_at: string
          expires_at: string
        }[]
      }
      get_account_deletion_status: {
        Args: { p_capability: string }
        Returns: {
          apple_manual_revocation_required: boolean
          attempt_count: number
          lease_expires_at: string
          next_attempt_at: string
          next_step_name: string
          next_step_status: string
          operation_expires_at: string
          operation_id: string
          operation_state: string
          receipt_expires_at: string
        }[]
      }
      get_apple_auth_deletion_vault: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: {
          apple_subject_hmac: string
          client_id: string
          encrypted_refresh_token: string
          generation: number
          vault_key_version: string
        }[]
      }
      get_health_data_consent_status: {
        Args: never
        Returns: {
          consent_text_hash: string
          consent_version: string
          epoch: number
          operation_id: string
          operation_state: string
          result_code: string
          server_verified_at: string
          state: string
          user_id: string
        }[]
      }
      get_health_dependent_consent_status: {
        Args: { p_consent_type: string }
        Returns: {
          consent_text_hash: string
          consent_type: string
          generation: number
          health_epoch: number
          state: string
          version: string
        }[]
      }
      grant_app_granted_reverse_trial:
        | {
            Args: {
              p_environment: string
              p_expires_at: string
              p_user_id: string
            }
            Returns: {
              acquisition_channel: string | null
              entitlement: string | null
              environment: string | null
              experiment_id: string | null
              expires_at: string | null
              is_active: boolean
              last_reconciled_at: string | null
              management_url: string | null
              offering_id: string | null
              original_purchase_at: string | null
              package_id: string | null
              period_type: string | null
              product_id: string | null
              raw_status: Json
              rc_cursor_state: string
              rc_event_at: string | null
              rc_event_id: string | null
              rc_event_priority: number | null
              rc_original_transaction_id: string | null
              rc_snapshot_at: string | null
              rc_snapshot_fingerprint: string | null
              rc_transaction_id: string | null
              source: string
              store: string | null
              store_user_id: string | null
              updated_at: string
              user_id: string
              verified_at: string | null
              will_renew: boolean | null
            }[]
            SetofOptions: {
              from: "*"
              to: "entitlements"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: {
              p_environment: string
              p_expires_at: string
              p_product_id: string
              p_user_id: string
            }
            Returns: {
              acquisition_channel: string | null
              entitlement: string | null
              environment: string | null
              experiment_id: string | null
              expires_at: string | null
              is_active: boolean
              last_reconciled_at: string | null
              management_url: string | null
              offering_id: string | null
              original_purchase_at: string | null
              package_id: string | null
              period_type: string | null
              product_id: string | null
              raw_status: Json
              rc_cursor_state: string
              rc_event_at: string | null
              rc_event_id: string | null
              rc_event_priority: number | null
              rc_original_transaction_id: string | null
              rc_snapshot_at: string | null
              rc_snapshot_fingerprint: string | null
              rc_transaction_id: string | null
              source: string
              store: string | null
              store_user_id: string | null
              updated_at: string
              user_id: string
              verified_at: string | null
              will_renew: boolean | null
            }[]
            SetofOptions: {
              from: "*"
              to: "entitlements"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      grant_health_data_consent: {
        Args: {
          p_consent_text_hash: string
          p_expected_epoch: number
          p_version: string
        }
        Returns: {
          consent_text_hash: string
          consent_version: string
          epoch: number
          operation_id: string
          operation_state: string
          result_code: string
          server_verified_at: string
          state: string
          user_id: string
        }[]
      }
      has_current_consent: {
        Args: { p_consent_type: string }
        Returns: boolean
      }
      invalidate_apple_auth_for_session: {
        Args: {
          p_apple_subject: string
          p_failure_code: string
          p_session_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      invalidate_apple_auth_lifecycle: {
        Args: {
          p_claim_token: string
          p_failure_code: string
          p_generation: number
          p_user_id: string
        }
        Returns: boolean
      }
      list_account_deletions_ready_to_finalize: {
        Args: { p_limit: number }
        Returns: {
          operation_id: string
          user_id: string
        }[]
      }
      list_account_photo_storage_objects: {
        Args: { p_after_name: string; p_limit: number; p_user_id: string }
        Returns: {
          object_name: string
        }[]
      }
      list_health_consent_storage_work: {
        Args: { p_claim_token: string; p_limit: number; p_operation_id: string }
        Returns: {
          storage_path: string
        }[]
      }
      list_health_dependent_consent_storage_work: {
        Args: { p_claim_token: string; p_limit: number; p_operation_id: string }
        Returns: {
          storage_path: string
        }[]
      }
      lookup_catalog_product_by_barcode: {
        Args: { p_barcode: string }
        Returns: {
          barcode: string
          brand: string
          catalog_source_id: string
          catalog_sources: Json
          category: string
          data_quality_score: number
          default_pao_months: number
          id: string
          ingredient_parse_confidence: number
          ingredient_parse_status: string
          name: string
          product_pao_expiry: Json
          quality_grade: string
          region: string
          review_status: string
          source: string
          source_ref: string
          source_snapshot_date: string
          source_url: string
        }[]
      }
      mark_account_deletion_step_request_started: {
        Args: {
          p_claim_token: string
          p_operation_id: string
          p_step_name: string
        }
        Returns: {
          claim_mode: string
          lease_expires_at: string
          request_started_at: string
          step_status: string
        }[]
      }
      mark_apple_auth_capture_exchange_started: {
        Args: {
          p_operation_id: string
          p_session_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      mark_health_dependent_consent_withdrawal_action_required: {
        Args: {
          p_claim_token: string
          p_operation_id: string
          p_result_code: string
        }
        Returns: {
          operation_id: string
          result_code: string
          state: string
        }[]
      }
      owns_ask_turn_audit: {
        Args: { p_turn_audit_id: string }
        Returns: boolean
      }
      owns_consent: { Args: { p_consent_id: string }; Returns: boolean }
      owns_cycle: { Args: { p_cycle_id: string }; Returns: boolean }
      owns_photo: { Args: { p_photo_id: string }; Returns: boolean }
      owns_routine: { Args: { p_routine_id: string }; Returns: boolean }
      owns_user_product: { Args: { p_product_id: string }; Returns: boolean }
      prepare_health_data_consent_withdrawal: {
        Args: { p_claim_token: string; p_operation_id: string }
        Returns: {
          operation_state: string
          pending_storage_objects: number
          result_code: string
        }[]
      }
      process_revenuecat_webhook_event: {
        Args: {
          p_aliases: string[]
          p_app_user_id: string
          p_auth_verified: boolean
          p_entitlement: string
          p_environment: string
          p_event_type: string
          p_expiration_at: string
          p_is_active: boolean
          p_offering_id: string
          p_original_app_user_id: string
          p_original_purchase_at: string
          p_original_transaction_id: string
          p_payload: Json
          p_period_type: string
          p_product_id: string
          p_projection_priority: number
          p_provider_event_at: string
          p_rc_event_id: string
          p_received_at: string
          p_should_project: boolean
          p_signature_verified: boolean
          p_store: string
          p_transaction_id: string
          p_transferred_from: string[]
          p_transferred_to: string[]
          p_user_candidates: string[]
          p_will_renew: boolean
        }
        Returns: {
          outcome: string
          processing_status: string
          projection_applied: boolean
        }[]
      }
      process_revenuecat_webhook_event_guarded:
        | {
            Args: {
              p_aliases: string[]
              p_app_user_id: string
              p_auth_verified: boolean
              p_entitlement: string
              p_environment: string
              p_event_type: string
              p_expiration_at: string
              p_is_active: boolean
              p_offering_id: string
              p_original_app_user_id: string
              p_original_purchase_at: string
              p_original_transaction_id: string
              p_payload: Json
              p_period_type: string
              p_product_id: string
              p_projection_priority: number
              p_provider_event_at: string
              p_rc_event_id: string
              p_received_at: string
              p_should_project: boolean
              p_signature_verified: boolean
              p_store: string
              p_transaction_id: string
              p_transferred_from: string[]
              p_transferred_to: string[]
              p_user_candidates: string[]
              p_will_renew: boolean
            }
            Returns: {
              outcome: string
              processing_status: string
              projection_applied: boolean
            }[]
          }
        | {
            Args: {
              p_aliases: string[]
              p_app_user_id: string
              p_auth_verified: boolean
              p_entitlement: string
              p_environment: string
              p_event_type: string
              p_expiration_at: string
              p_identity_hmac_key_versions: number[]
              p_identity_hmacs: string[]
              p_identity_values: string[]
              p_is_active: boolean
              p_offering_id: string
              p_original_app_user_id: string
              p_original_purchase_at: string
              p_original_transaction_id: string
              p_payload: Json
              p_period_type: string
              p_product_id: string
              p_projection_priority: number
              p_provider_event_at: string
              p_rc_event_id: string
              p_received_at: string
              p_should_project: boolean
              p_signature_verified: boolean
              p_store: string
              p_transaction_id: string
              p_transferred_from: string[]
              p_transferred_to: string[]
              p_user_candidates: string[]
              p_will_renew: boolean
            }
            Returns: {
              outcome: string
              processing_status: string
              projection_applied: boolean
            }[]
          }
      promote_catalog_import: {
        Args: {
          p_batch_id: string
          p_operation_key: string
          p_operator: string
          p_review_evidence_sha256: string
          p_review_ticket: string
        }
        Returns: {
          affected_entity_count: number
          batch_id: string
          promotion_event_id: string
          replayed: boolean
        }[]
      }
      promote_health_consent_copy_for_release: {
        Args: {
          p_action: string
          p_consent_text_hash: string
          p_consent_type: string
          p_review_evidence_hash: string
          p_review_ticket: string
          p_reviewed_by: string
          p_version: string
        }
        Returns: {
          action: string
          consent_text_hash: string
          consent_type: string
          review_event_id: string
          review_evidence_hash: string
          review_status: string
          review_ticket: string
          reviewed_at: string
          reviewed_by: string
          version: string
        }[]
      }
      purge_expired_account_deletion_artifacts: {
        Args: { p_limit: number }
        Returns: {
          active_accounts_retained: number
          encrypted_credentials_redacted: number
          operations_deleted: number
          operator_audits_deleted: number
          receipts_deleted: number
        }[]
      }
      purge_expired_apple_auth_artifacts: {
        Args: { p_limit: number }
        Returns: number
      }
      purge_expired_edge_rate_limits: {
        Args: { p_limit: number }
        Returns: number
      }
      purge_expired_revenuecat_identity_tombstones: {
        Args: { p_limit: number }
        Returns: number
      }
      read_entitlement_projections: { Args: never; Returns: Json }
      reap_expired_account_publication_leases: {
        Args: { p_limit: number }
        Returns: {
          leases_closed: number
          leases_purged: number
          operations_drained: number
        }[]
      }
      recompute_streak: { Args: { p_user_id: string }; Returns: undefined }
      reconcile_revenuecat_entitlement_snapshot: {
        Args: {
          p_entitlement: string
          p_environment: string
          p_expires_at: string
          p_is_active: boolean
          p_management_url: string
          p_offering_id: string
          p_original_purchase_at: string
          p_package_id: string
          p_period_type: string
          p_product_id: string
          p_snapshot_at: string
          p_store: string
          p_user_id: string
          p_will_renew: boolean
        }
        Returns: string
      }
      record_account_deletion_revenuecat_absence_observation: {
        Args: {
          p_claim_token: string
          p_operation_id: string
          p_step_name: string
        }
        Returns: {
          confirmed: boolean
          observation_count: number
        }[]
      }
      record_account_deletion_step: {
        Args: {
          p_claim_token: string
          p_operation_id: string
          p_outcome: string
          p_result_code: string
          p_retry_at: string
          p_step_name: string
        }
        Returns: {
          next_attempt_at: string
          operation_state: string
          step_status: string
        }[]
      }
      record_catalog_lookup_event: {
        Args: {
          p_expected_health_epoch: number
          p_lookup_type: string
          p_rate_limit: number
          p_result: string
          p_user_id: string
          p_window_seconds: number
        }
        Returns: string
      }
      record_health_dependent_consent: {
        Args: {
          p_consent_text_hash: string
          p_consent_type: string
          p_expected_epoch: number
          p_expected_generation: number
          p_idempotency_key: string
          p_version: string
        }
        Returns: {
          consent_text_hash: string
          consent_type: string
          generation: number
          health_epoch: number
          state: string
          version: string
        }[]
      }
      record_routine_completion: {
        Args: {
          p_completed_at: string
          p_completed_date: string
          p_event_id: string
          p_routine_id: string
          p_routine_type: string
          p_step_id: string
          p_step_order: number
          p_timezone: string
          p_user_product_id: string
        }
        Returns: Json
      }
      recover_account_deletion_step: {
        Args: {
          p_command_token: string
          p_operation_id: string
          p_reason_code: string
          p_recovery_mode: string
          p_step_name: string
        }
        Returns: {
          next_attempt_at: string
          operation_state: string
          step_status: string
        }[]
      }
      refresh_product_correction_count: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      refresh_routine_adherence: {
        Args: never
        Returns: {
          adherence_timezone: string
          algorithm_version: number
          current_streak: number
          frozen_dates: string[]
          lapsed: boolean
          longest_streak: number
          reference_day: string
        }[]
      }
      release_account_publication_lease: {
        Args: { p_capability: string }
        Returns: {
          status: string
        }[]
      }
      release_catalog_launch_curation_campaign: {
        Args: {
          p_actor: string
          p_campaign_id: string
          p_expected_authorization_set_sha256: string
          p_expected_campaign_sha256: string
          p_expected_record_set_sha256: string
          p_expected_served_state_mutation_root_set_sha256: string
          p_operation_key: string
          p_reason_code: string
        }
        Returns: {
          campaign_id: string
          cat02_database_observation_sha256: string
          cat02_membership_proof_sha256: string
          cat02_production_integrity_set_sha256: string
          cat02_verifier_signature_set_sha256: string
          curation_outcome_reviewer_signature_set_sha256: string
          head_generation: number
          release_event_id: string
          replayed: boolean
          served_state_mutation_root_set_sha256: string
        }[]
      }
      release_catalog_launch_curation_campaign_v0058: {
        Args: {
          p_actor: string
          p_campaign_id: string
          p_expected_authorization_set_sha256: string
          p_expected_campaign_sha256: string
          p_expected_record_set_sha256: string
          p_expected_served_state_mutation_root_set_sha256: string
          p_operation_key: string
          p_reason_code: string
        }
        Returns: {
          campaign_id: string
          cat02_database_observation_sha256: string
          cat02_membership_proof_sha256: string
          cat02_production_integrity_set_sha256: string
          cat02_verifier_signature_set_sha256: string
          curation_outcome_reviewer_signature_set_sha256: string
          head_generation: number
          release_event_id: string
          replayed: boolean
          served_state_mutation_root_set_sha256: string
        }[]
      }
      renew_account_publication_lease: {
        Args: { p_capability: string; p_session_id: string; p_user_id: string }
        Returns: {
          status: string
        }[]
      }
      reserve_account_publication_lease: {
        Args: { p_capability: string; p_session_id: string; p_user_id: string }
        Returns: {
          status: string
        }[]
      }
      reset_account_deletion_revenuecat_absence_observations: {
        Args: {
          p_claim_token: string
          p_operation_id: string
          p_step_name: string
        }
        Returns: {
          reset: boolean
        }[]
      }
      retire_catalog_launch_curation: {
        Args: {
          p_actor: string
          p_expected_active_curation_record_sha256: string
          p_operation_key: string
          p_product_id: string
          p_reason: string
        }
        Returns: {
          curation_event_id: string
          head_generation: number
          product_id: string
          replayed: boolean
        }[]
      }
      retire_catalog_launch_curation_campaign: {
        Args: {
          p_actor: string
          p_campaign_id: string
          p_expected_campaign_sha256: string
          p_operation_key: string
          p_reason_code: string
        }
        Returns: {
          campaign_id: string
          cat02_database_observation_sha256: string
          cat02_membership_proof_sha256: string
          cat02_production_integrity_set_sha256: string
          cat02_verifier_signature_set_sha256: string
          curation_outcome_reviewer_signature_set_sha256: string
          head_generation: number
          release_event_id: string
          replayed: boolean
          served_state_mutation_root_set_sha256: string
        }[]
      }
      review_catalog_correction: {
        Args: {
          p_correction_id: string
          p_expected_health_epoch: number
          p_review_note: string
          p_review_status: string
          p_reviewed_by: string
        }
        Returns: {
          id: string
          operator_reviewed_at: string
          status: string
        }[]
      }
      review_catalog_import: {
        Args: {
          p_batch_id: string
          p_decisions: Json
          p_expected_batch_evidence_sha256: string
          p_expected_candidates_sha256: string
          p_expected_verification_evidence_sha256: string
          p_operation_key: string
          p_review_evidence_sha256: string
          p_review_ticket: string
          p_reviewer_ids: string[]
        }
        Returns: {
          accepted_record_count: number
          batch_id: string
          batch_status: string
          rejected_record_count: number
          replayed: boolean
        }[]
      }
      rollback_catalog_import: {
        Args: {
          p_batch_id: string
          p_operation_key: string
          p_operator: string
          p_reason: string
          p_review_evidence_sha256: string
          p_review_ticket: string
        }
        Returns: {
          affected_entity_count: number
          batch_id: string
          replayed: boolean
          rollback_event_id: string
        }[]
      }
      scrub_account_service_rows: { Args: { p_user_id: string }; Returns: Json }
      search_catalog_products: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          barcode: string
          brand: string
          catalog_source_id: string
          catalog_sources: Json
          category: string
          data_quality_score: number
          default_pao_months: number
          id: string
          ingredient_parse_confidence: number
          ingredient_parse_status: string
          name: string
          product_pao_expiry: Json
          quality_grade: string
          region: string
          review_status: string
          source: string
          source_ref: string
          source_snapshot_date: string
          source_url: string
        }[]
      }
      set_recommendation_preferences: {
        Args: {
          p_budget_band: string
          p_format_prefs: string[]
          p_values_filters: string[]
        }
        Returns: {
          budget_band: string
          format_prefs: string[]
          updated_at: string
          user_id: string
          values_filters: string[]
        }[]
      }
      set_routine_adherence_timezone: {
        Args: { p_timezone: string }
        Returns: {
          adherence_timezone: string
          algorithm_version: number
          current_streak: number
          frozen_dates: string[]
          lapsed: boolean
          longest_streak: number
          reference_day: string
        }[]
      }
      stage_catalog_import_chunk: {
        Args: {
          p_batch_id: string
          p_chunk_ordinal: number
          p_first_record_ordinal: number
          p_operation_key: string
          p_records: Json
        }
        Returns: {
          batch_id: string
          chunk_ordinal: number
          chunk_sha256: string
          record_receipts: Json
          replayed: boolean
          staged_record_count: number
        }[]
      }
      stage_health_consent_copy_draft_successor: {
        Args: {
          p_action: string
          p_consent_type: string
          p_previous_consent_text_hash: string
          p_previous_version: string
          p_staged_by: string
          p_staging_change_reference: string
          p_staging_evidence_hash: string
          p_successor_consent_text_hash: string
          p_successor_version: string
        }
        Returns: {
          action: string
          consent_type: string
          previous_consent_text_hash: string
          previous_version: string
          staged_at: string
          staged_by: string
          staging_change_reference: string
          staging_event_id: string
          staging_evidence_hash: string
          successor_consent_text_hash: string
          successor_is_current: boolean
          successor_review_status: string
          successor_version: string
        }[]
      }
      submit_catalog_correction: {
        Args: {
          p_barcode: string
          p_client_context: Json
          p_correction_type: string
          p_description: string
          p_expected_health_epoch: number
          p_product_id: string
          p_proposed_payload: Json
          p_report_request_id: string
          p_user_id: string
        }
        Returns: {
          created: boolean
          created_at: string
          id: string
          status: string
        }[]
      }
      supersede_health_consent_copy_for_release: {
        Args: {
          p_action: string
          p_consent_type: string
          p_previous_consent_text_hash: string
          p_previous_version: string
          p_review_evidence_hash: string
          p_review_ticket: string
          p_reviewed_by: string
          p_successor_consent_text_hash: string
          p_successor_version: string
        }
        Returns: {
          action: string
          consent_type: string
          lifecycle_event_id: string
          previous_consent_text_hash: string
          previous_version: string
          review_evidence_hash: string
          review_ticket: string
          reviewed_at: string
          reviewed_by: string
          successor_consent_text_hash: string
          successor_is_current: boolean
          successor_review_status: string
          successor_version: string
        }[]
      }
      sync_shelf_product: {
        Args: {
          p_enqueued_at: string
          p_operation_id: string
          p_operation_kind: string
          p_payload: Json
          p_product_id: string
        }
        Returns: Json
      }
      update_account_deletion_step_payload: {
        Args: {
          p_claim_token: string
          p_encrypted_payload: string
          p_operation_id: string
          p_step_name: string
        }
        Returns: {
          claim_mode: string
          encrypted_payload_digest: string
          encrypted_payload_octets: number
          lease_expires_at: string
          payload_updated_at: string
          request_started_at: string
          step_status: string
        }[]
      }
      verify_catalog_import: {
        Args: {
          p_batch_id: string
          p_operation_key: string
          p_records_sha256: string
          p_verification_evidence_sha256: string
        }
        Returns: {
          batch_id: string
          batch_status: string
          replayed: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
