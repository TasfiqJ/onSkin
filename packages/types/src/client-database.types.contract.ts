import type { Database as GeneratedDatabase } from './database.types';
import type { ClientDatabase } from './client-database.types';

type Assert<Condition extends true> = Condition;
type IsNever<Value> = [Value] extends [never] ? true : false;
type IsNotNever<Value> = IsNever<Value> extends true ? false : true;
type Extends<Left, Right> = [Left] extends [Right] ? true : false;
type DoesNotExtend<Left, Right> = Extends<Left, Right> extends true ? false : true;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;

type _GeneratedSchemaRetained = Assert<
  Extends<keyof ClientDatabase['public']['Tables'], keyof GeneratedDatabase['public']['Tables']>
>;
type _OnlyReviewedTablesExposed = Assert<
  Extends<
    keyof ClientDatabase['public']['Tables'],
    'consents' | 'photos' | 'routine_completions' | 'skin_profiles'
  >
>;
type _ConsentInsertAdmitted = Assert<
  IsNotNever<ClientDatabase['public']['Tables']['consents']['Insert']>
>;
type _SkinProfileInsertAdmitted = Assert<
  IsNotNever<ClientDatabase['public']['Tables']['skin_profiles']['Insert']>
>;
type _PhotoInsertDenied = Assert<IsNever<ClientDatabase['public']['Tables']['photos']['Insert']>>;
type _RoutineCompletionInsertDenied = Assert<
  IsNever<ClientDatabase['public']['Tables']['routine_completions']['Insert']>
>;
type _ConsentUpdateDenied = Assert<
  IsNever<ClientDatabase['public']['Tables']['consents']['Update']>
>;
type _SkinProfileUpdateDenied = Assert<
  IsNever<ClientDatabase['public']['Tables']['skin_profiles']['Update']>
>;
type _GeneratedFunctionsRetained = Assert<
  Extends<
    keyof ClientDatabase['public']['Functions'],
    keyof GeneratedDatabase['public']['Functions']
  >
>;
type _OnlyReviewedFunctionsExposed = Assert<
  Extends<
    keyof ClientDatabase['public']['Functions'],
    | 'get_health_dependent_consent_status'
    | 'read_entitlement_projections'
    | 'record_health_dependent_consent'
    | 'record_routine_completion'
    | 'set_recommendation_preferences'
    | 'set_routine_adherence_timezone'
    | 'sync_shelf_product'
  >
>;
type _RecommendationBudgetAllowsTheSqlNullState = Assert<
  Equal<
    ClientDatabase['public']['Functions']['set_recommendation_preferences']['Args']['p_budget_band'],
    string | null
  >
>;
type RecommendationArgs =
  ClientDatabase['public']['Functions']['set_recommendation_preferences']['Args'];
type _RecommendationBudgetKeyRemainsRequired = Assert<
  DoesNotExtend<{ p_values_filters: string[]; p_format_prefs: string[] }, RecommendationArgs>
>;
type CompletionArgs = ClientDatabase['public']['Functions']['record_routine_completion']['Args'];
type CompletionCommonArgs = {
  p_completed_at: string;
  p_completed_date: string;
  p_event_id: string;
  p_routine_id: string;
  p_timezone: string;
};
type _CompletionStepAccepted = Assert<
  Extends<
    CompletionCommonArgs & {
      p_routine_type: 'AM';
      p_step_id: string;
      p_step_order: number;
      p_user_product_id: string;
    },
    CompletionArgs
  >
>;
type _CompletionPmMarkerAccepted = Assert<
  Extends<
    CompletionCommonArgs & {
      p_routine_type: 'PM';
      p_step_id: null;
      p_step_order: null;
      p_user_product_id: null;
    },
    CompletionArgs
  >
>;
type _CompletionMixedNullTupleRejected = Assert<
  DoesNotExtend<
    CompletionCommonArgs & {
      p_routine_type: 'PM';
      p_step_id: null;
      p_step_order: number;
      p_user_product_id: string;
    },
    CompletionArgs
  >
>;
type _CompletionAmMarkerRejected = Assert<
  DoesNotExtend<
    CompletionCommonArgs & {
      p_routine_type: 'AM';
      p_step_id: null;
      p_step_order: null;
      p_user_product_id: null;
    },
    CompletionArgs
  >
>;
type _NoViewsExposed = Assert<IsNever<keyof ClientDatabase['public']['Views']>>;
