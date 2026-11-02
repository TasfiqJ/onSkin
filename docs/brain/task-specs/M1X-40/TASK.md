{
  "schema": 1,
  "authority": "BRAIN-M1X-CAT08-ROLE-CLEANUP40-SOURCE-REPAIR-01",
  "base": "d5f3b4b46bb12a666fa793b5eaa641442db94c8e",
  "baseTree": "4ebbe4124e7aa695a4f5172ba83ebf9479ef5207",
  "planCommit": "cfc2888f4baa4df58550ce1c77aa94dabd715b3c",
  "sourceHashes": {
    ".github/workflows/quality.yml": "25d3c4c73405d7e4d6dcbb3b9ef86a2beb89d87760d9107464c4fcddb76e27e7",
    "PROGRESS.md": "b3606e9b1ea8aa9703e9605be02e7e225d780a6e759d7b11f8b2cb72ba4f24d6",
    "docs/release/full-app-j01/cat08-role-cleanup40.md": "8ce333d6459607fee8e59d6d92ab2fa4f946699bc198d9326f4361c299e46ac0",
    "scripts/phase2/catalog-operator-cat08-cleanup40.test.mjs": "e9e82258617faf172f9c56e799c727d6919d5294d34636a59680e3cb4fa269f5",
    "scripts/release/full-app-j01/main_integration40.py": "3494b35e27238dbd3f078973186feed770bf413ede221c8e68b3ff9441c0b64c",
    "scripts/release/full-app-j01/main_integration40.test.py": "c8f3211903577099653d5ce0bf4765344f99e950e18077af9441a4962ebf81be",
    "scripts/release/full-app-j01/source_consumer40.test.py": "f94991a5231708c77aa8874713f71e3f3f20f256b34203f1afe51d1802dd9745",
    "supabase/tests/rehearsal/catalog_operator_revocation_race.test.sql": "ca5e93879ba109c5932ac1549e4b33294a279c3df3c9b2021d9529fd73c4ed89"
  },
  "commands": [
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration40.py",
        "--historical"
      ],
      "exit": 0,
      "qualification": "AUTHENTIC_EXACT_PR42_ORIGINAL39_AND_NESTED_HISTORY_NOT_CURRENT_APPROVAL",
      "logSha256": "3d2bc453a61cde81cd1db50a5bdfc0eb6187369800ebc6378b69e50cc1d56535"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/phase2/catalog-operator-cat08-cleanup40.test.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "bf0dde046922c41f3bc666142a953d82b18d35f406236dcf1527b98a8fc15404"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.exe",
        "--test",
        "scripts/phase2/catalog-operator-cat08-cleanup40.test.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "8e6bed9a859d3a32d3c63c702035464eb651d9002312522b423ad9401b385f68"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration40.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "8f07c955461f383833ca3db36d4e81f0b94b5ae62391a8800137128b02e6230c"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/source_consumer40.test.py"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "a0e8bbc66988b58ff278cf7517a3421ff659565554cdf840c46c378fc6ba39dc"
    },
    {
      "command": [
        "C:\\Python39\\python.exe",
        "-I",
        "-B",
        "scripts/release/full-app-j01/main_integration40.py",
        "--phase",
        "SOURCE_PENDING"
      ],
      "exit": 1,
      "qualification": "ACTUAL_NONZERO_ATTEMPT_PRESERVED_NOT_ACCEPTANCE",
      "logSha256": "522c32b33e8275b346262ad2619fda067542175d0215df1db87b5e906b3656e7"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "phase2:db-local-contract"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "e340e611bc12545a8da761a11fdb97a9904497cbba78594723b169372f69ae87"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\jasim\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "phase2:db-local-contract"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "b88b2b3343baed6c46d7cbde571592a8360e3086562e4433a2d51fdacadecd05"
    },
    {
      "command": [
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\jasim\\AppData\\Roaming\\npm\\node_modules\\npm\\bin\\npm-cli.js",
        "ci",
        "--ignore-scripts=false",
        "--no-audit",
        "--no-fund"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "7f153397c7eb929478c1ad2cb803ecfdff06405573c70601efdc485c22eb792e"
    },
    {
      "command": [
        "git",
        "ls-remote",
        "origin",
        "refs/heads/main",
        "refs/heads/stage/m1-owned-formula-version38",
        "refs/heads/stage/m1-formula-route-inventory39",
        "refs/heads/stage/m1-cat08-role-cleanup40",
        "refs/pull/41/head",
        "refs/pull/42/head"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "b53afa013631cbfa3b76b8ed173c42c5d9ba657a3aadefbe6697d7be523be28c"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/phase2/catalog-operator-cat08-cleanup40.test.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "9fbaabcc0823b72dc9ad3803bdbda4c21679bcf21aeaf0d93f38e1e3fd13d38c"
    },
    {
      "command": [
        "node",
        "--test",
        "scripts/phase2/canonical-postgres-mirror24.test.mjs"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "4affb2dee87da61829dbb400cc0e16fe57f606fd0bc8fac4ef81809ac71ecf98"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "phase4:operator-authority-contract:test"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "65d852fe52d5fe7422783130ef72d392c4d1a9979b90dfe26dea9e2be7d3cd17"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "phase4:catalog-operator-edge:format:check"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "b17936c6b579eefee223426b5ca09726b382e3a2812b3f81a974055333714198"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "phase4:catalog-operator-edge:test"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "843c996f3cbf8c79f9ca09884da85d4550a7af326be904c58117124a05766e57"
    },
    {
      "command": [
        "C:\\Users\\jasim\\AppData\\Roaming\\npm\\node_modules\\deno\\deno.exe",
        "test",
        "--no-config",
        "--quiet",
        "--allow-read=supabase",
        "--lock=supabase/functions/deno.lock",
        "--frozen=true",
        "supabase/functions/catalog-operator/httpHandler.test.ts",
        "supabase/functions/catalog-operator/contract.test.ts",
        "supabase/functions/catalog-operator/databaseGateway.test.ts",
        "supabase/functions/catalog-operator/databaseUrl.test.ts",
        "supabase/functions/catalog-operator/responseContract.test.ts",
        "supabase/functions/catalog-operator/runtimeContext.test.ts",
        "supabase/functions/catalog-operator/verifiedAuth.test.ts"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "c6b699e4b96a8f4eaec978ab7a6ebf31f58d7c8a4c98091a62854ad58b6b84ae"
    },
    {
      "command": [
        "deno",
        "test",
        "--no-config",
        "--quiet",
        "--allow-read=supabase",
        "--lock=supabase/functions/deno.lock",
        "--frozen=true",
        "supabase/functions/catalog-operator/httpHandler.test.ts",
        "supabase/functions/catalog-operator/contract.test.ts",
        "supabase/functions/catalog-operator/databaseGateway.test.ts",
        "supabase/functions/catalog-operator/databaseUrl.test.ts",
        "supabase/functions/catalog-operator/responseContract.test.ts",
        "supabase/functions/catalog-operator/runtimeContext.test.ts",
        "supabase/functions/catalog-operator/verifiedAuth.test.ts"
      ],
      "exit": -1,
      "qualification": "ACTUAL_NONZERO_ATTEMPT_PRESERVED_NOT_ACCEPTANCE",
      "logSha256": "beeb52bf5bab0f5529e2b1d7b41ed1cee0f486fd7279ee17885c7eeaee3d14ac"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "phase4:catalog-operator-edge:test"
      ],
      "exit": 1,
      "qualification": "ACTUAL_NONZERO_ATTEMPT_PRESERVED_NOT_ACCEPTANCE",
      "logSha256": "fe873875ea077cd9b925d7beeb430d69808d39933badd89b44fe13f9b8630464"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "core04:persistence-source-contract:test"
      ],
      "exit": 1,
      "qualification": "ACTUAL_NONZERO_ATTEMPT_PRESERVED_NOT_ACCEPTANCE",
      "logSha256": "9924d3318d9132ec8c571e5b48f6f8b7168a47e2038ace956feacb24d7e95622"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "core06:recommendation-db-contract"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "67bc1d3a383e997211a5df99fd3822a526b5f9b9692a4ced6961f99039d6158a"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "core06:recommendation-admission-source-contract:test"
      ],
      "exit": 1,
      "qualification": "ACTUAL_NONZERO_ATTEMPT_PRESERVED_NOT_ACCEPTANCE",
      "logSha256": "aeb32cf1e5dbd786e19af19bac817fd8641077cf69391e4fd84405a4888631a8"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "core07:share-admission-source-contract:test"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "2b1a354f8b23afd5171125e9c29d7ad7eaec0174af940600f768ee6eaf58cbe3"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "launch:execution-baseline:check"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "13da25b45eaf13d605a3e3da1caeb578cc5c5eea7d4e7cd2ef2d289f5aa7a5f6"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "launch:execution-baseline:smoke"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "88527dac7a7c72dbc0db83a8a43d4029c4d006f5c9faae43c16f3c4d652fb9a2"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "launch:contract:verify"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "252555f0e55e5ea6fd4e5a35cca547d19bedf1adb6a1d154b5a269705d408962"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "pay07:entitlement-admission-source-contract:test"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "3124cc991d2ade5d29df4499ceb80f356a5a21f4b6fab0243e3968dd14601d09"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "postinstall:check"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "5dd8278bf0b53f3b6607c8bd1e2a69a4cef4d30a54b304d2c660232f1be652b7"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "phase9:rls-adversarial-smoke"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "87335ac89e81c1c5ef47e57135c93ce5692da703d07c5de09c14109da7c7ad54"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "lint"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "7ac6dba1dae092fa97212b3d6e7bda90199f8410cab947843199c172e0473c58"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "test"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "bf95327371c3a3c776bd7e12cb1bd529cebb13f0d0b77aeda4d63a78cf398acb"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "typecheck"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "9999ac47b58010ce76c022787d2864f92fcc5742ea86eae5e55e900ad65f13fc"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "phase9:supabase-policy-lint"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "14d2ff120def01630f588d9593b0c712d41ea5a48b0532267653eed2caf209cc"
    },
    {
      "command": [
        "node",
        "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
        "run",
        "phase6:trusted-entitlements-evidence:test"
      ],
      "exit": 0,
      "qualification": "ACTUAL_LOCAL_COMMAND_NOT_HOSTED_OR_QUALIFIED_ACCEPTANCE",
      "logSha256": "05a23de895f4e75c727d27a253455ff597d9c766b0dcfee80e8971d46606d677"
    },
    {
      "command": [
        "npm",
        "run",
        "phase2:db-local-verify"
      ],
      "exit": null,
      "qualification": "NOT_RUN_LOCAL_DOCKER_STARTUP_FAILURE_AND_MISSING_WSL_DISK",
      "logSha256": "fb9766da54383d9052d49365c009e4200541b45327ea9813c4d18700139f99ba"
    },
    {
      "command": [
        "node",
        "scripts/phase2/catalog-operator-cat08-cleanup40.test.mjs",
        "--behavioral"
      ],
      "exit": null,
      "qualification": "NOT_RUN_LOCALLY_REQUIRES_GENUINE_HOSTED_JOB_ISOLATED_PG15",
      "logSha256": null
    }
  ],
  "acceptanceGranted": false,
  "admissions": {
    "DB06": false,
    "DB08": false,
    "R2B": false,
    "M103": false,
    "M2": false,
    "NATIVE": false,
    "J01": false,
    "CLINICAL": false,
    "PROVIDER": false,
    "PAID": false,
    "APPLE": false,
    "PUBLIC": false,
    "G97": false
  },
  "release": "NO_GO",
  "qualification": "SOURCE_INTEGRITY_NOT_QUALIFIED_ACCEPTANCE"
}
