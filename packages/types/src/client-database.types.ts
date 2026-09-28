import type { Database as GeneratedDatabaseShape } from './database.types';

export type { Json } from './database.types';

type PublicSchema = GeneratedDatabaseShape['public'];
type MobileTableName = 'consents' | 'photos' | 'routine_completions' | 'skin_profiles';
type MobileFunctionName =
  | 'get_health_dependent_consent_status'
  | 'read_entitlement_projections'
  | 'record_health_dependent_consent'
  | 'record_routine_completion'
  | 'set_recommendation_preferences'
  | 'set_routine_adherence_timezone'
  | 'sync_shelf_product';
type DirectMobileInsertTable = 'consents' | 'skin_profiles';
type GeneratedFunction<FunctionName extends MobileFunctionName> =
  PublicSchema['Functions'][FunctionName];
type CompletionFunctionArgs = Omit<
  GeneratedFunction<'record_routine_completion'>['Args'],
  'p_routine_type' | 'p_step_id' | 'p_step_order' | 'p_user_product_id'
> &
  (
    | {
        p_routine_type: 'AM' | 'PM';
        p_step_id: string;
        p_step_order: number;
        p_user_product_id: string;
      }
    | {
        p_routine_type: 'PM';
        p_step_id: null;
        p_step_order: null;
        p_user_product_id: null;
      }
  );

// PostgreSQL function arguments are nullable unless a function is declared
// STRICT, but the generated API artifact cannot express that catalog-level
// distinction. These two reviewed RPCs intentionally use null as a bounded
// domain value in their SQL implementations, so the client overlay records the
// narrower runtime contract without editing the generated schema artifact.
type ClientFunction<FunctionName extends MobileFunctionName> = Omit<
  GeneratedFunction<FunctionName>,
  'Args'
> & {
  Args: FunctionName extends 'record_routine_completion'
    ? CompletionFunctionArgs
    : FunctionName extends 'set_recommendation_preferences'
      ? Omit<GeneratedFunction<FunctionName>['Args'], 'p_budget_band'> & {
          p_budget_band: string | null;
        }
      : GeneratedFunction<FunctionName>['Args'];
};

type ClientTable<TableName extends MobileTableName> = Omit<
  PublicSchema['Tables'][TableName],
  'Insert' | 'Update'
> & {
  Insert: TableName extends DirectMobileInsertTable
    ? PublicSchema['Tables'][TableName]['Insert']
    : never;
  Update: never;
};

/**
 * Supabase schema surface exposed to the publishable-key mobile client.
 *
 * Generated schema types describe database shape, not runtime grants. This
 * overlay therefore defaults direct table inserts and updates to `never` and
 * admits only the two reviewed append-only/bootstrap insert lanes. Reads,
 * owner photo deletion, and reviewed RPCs retain their generated types. The
 * DB-08 source contract separately rejects unreviewed direct delete calls.
 * PostgreSQL grants and RLS remain the security boundary.
 */
export type ClientDatabase = Omit<GeneratedDatabaseShape, 'public'> & {
  public: Omit<PublicSchema, 'Tables' | 'Views' | 'Functions'> & {
    Tables: {
      [TableName in MobileTableName]: ClientTable<TableName>;
    };
    Views: Pick<PublicSchema['Views'], never>;
    Functions: {
      [FunctionName in MobileFunctionName]: ClientFunction<FunctionName>;
    };
  };
};

export type Database = ClientDatabase;
