import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.git/**',
      'coverage/**',
      '*.min.js',
      'vendor/**',
      '.playwright-mcp/**',
      'report/**',
      'jscpd-report.json/**',
    ],
  },
  js.configs.recommended,
  prettierConfig,
  {
    plugins: {
      prettier,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'writable',
        global: 'readonly',
        module: 'writable',
        require: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        Promise: 'readonly',
        fetch: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        history: 'readonly',
        location: 'readonly',
        navigator: 'readonly',
        FormData: 'readonly',
        XMLHttpRequest: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        Node: 'readonly',
        NodeList: 'readonly',
        DOMParser: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        requestAnimationFrame: 'readonly',
      },
    },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error', 'info'],
        },
      ],
      'no-debugger': 'error',
      'no-alert': 'warn',
      'no-var': 'error',
      'prefer-const': [
        'error',
        {
          destructuring: 'any',
          ignoreReadBeforeAssign: false,
        },
      ],
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-with': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      curly: ['error', 'all'],
      'brace-style': ['error', '1tbs'],
      'no-throw-literal': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
      'no-promise-executor-return': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-duplicate-imports': 'error',
      'no-useless-rename': 'error',
      'object-shorthand': ['error', 'always'],
      'no-prototype-builtins': 'error',
      'no-extend-native': 'error',
      'no-new-object': 'error',
      'no-array-constructor': 'error',
      'array-callback-return': 'error',
      'no-useless-escape': 'error',
      'no-loop-func': 'error',
      'no-param-reassign': [
        'error',
        {
          props: true,
          ignorePropertyModificationsFor: [
            'acc',
            'e',
            'ctx',
            'req',
            'res',
            'request',
            'response',
            'state',
          ],
        },
      ],
      'no-iterator': 'error',
      'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'no-useless-constructor': 'error',
      'class-methods-use-this': 'off',
      'consistent-return': 'error',
      'default-case': ['error', { commentPattern: '^no default$' }],
      'default-param-last': 'error',
      'dot-notation': 'error',
      'guard-for-in': 'error',
      'max-classes-per-file': ['error', 1],
      'no-caller': 'error',
      'no-else-return': 'error',
      'no-empty-function': [
        'error',
        {
          allow: ['arrowFunctions', 'functions', 'methods'],
        },
      ],
      'no-eq-null': 'off',
      'no-extra-bind': 'error',
      'no-extra-label': 'error',
      'no-floating-decimal': 'error',
      'no-implicit-coercion': 'error',
      'no-implicit-globals': 'error',
      'no-invalid-this': 'error',
      'no-lone-blocks': 'error',
      'no-multi-spaces': 'error',
      'no-multi-str': 'error',
      'no-new': 'error',
      'no-new-wrappers': 'error',
      'no-octal-escape': 'error',
      'no-redeclare': 'error',
      'no-return-assign': ['error', 'always'],
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unused-expressions': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-useless-return': 'error',
      'no-void': 'error',
      'prefer-named-capture-group': 'warn',
      radix: 'error',
      'require-unicode-regexp': 'warn',
      'vars-on-top': 'error',
      yoda: 'error',
      'no-label-var': 'error',
      'no-shadow': 'error',
      'no-shadow-restricted-names': 'error',
      'no-undef-init': 'error',
      'no-undefined': 'off',
      'no-use-before-define': [
        'error',
        {
          functions: false,
          classes: true,
          variables: true,
        },
      ],
      camelcase: [
        'error',
        {
          properties: 'never',
          ignoreDestructuring: false,
        },
      ],
      'func-style': [
        'error',
        'declaration',
        {
          allowArrowFunctions: true,
        },
      ],
      'max-depth': ['error', 4],
      'max-lines': [
        'warn',
        {
          max: 1500, // Increased from 500 to accommodate large admin panels
          skipBlankLines: true,
          skipComments: true,
        },
      ],
      'max-lines-per-function': [
        'warn',
        {
          max: 300, // Increased from 100 for complex UI functions
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true,
        },
      ],
      'max-nested-callbacks': ['error', 5], // Increased to 5 for test files with describe/it nesting
      'max-params': ['warn', 5],
      'max-statements': ['warn', 100], // Increased from 15 to accommodate complex business logic and UI functions
      'new-cap': [
        'error',
        {
          newIsCap: true,
          newIsCapExceptions: [],
          capIsNew: false,
          capIsNewExceptions: ['Immutable.Map', 'Immutable.Set', 'Immutable.List'],
        },
      ],
      'no-bitwise': 'error',
      'no-continue': 'warn',
      'no-lonely-if': 'error',
      'no-mixed-operators': [
        'error',
        {
          groups: [
            ['&', '|', '^', '~', '<<', '>>', '>>>'],
            ['==', '!=', '===', '!==', '>', '>=', '<', '<='],
            ['&&', '||'],
            ['in', 'instanceof'],
          ],
          allowSamePrecedence: true,
        },
      ],
      'no-multi-assign': 'error',
      'no-negated-condition': 'error',
      'no-nested-ternary': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
      'no-underscore-dangle': [
        'error',
        {
          allow: ['_id'],
          allowAfterThis: false,
          allowAfterSuper: false,
          enforceInMethodNames: true,
        },
      ],
      'no-unneeded-ternary': 'error',
      'one-var': ['error', 'never'],
      'operator-assignment': ['error', 'always'],
      'prefer-exponentiation-operator': 'error',
      'prefer-object-spread': 'error',
      'spaced-comment': [
        'error',
        'always',
        {
          line: {
            exceptions: ['-', '+'],
            markers: ['=', '!', '/'],
          },
          block: {
            exceptions: ['-', '+'],
            markers: ['=', '!', ':', '::'],
            balanced: true,
          },
        },
      ],
      'arrow-body-style': ['error', 'as-needed'],
      'arrow-parens': ['error', 'always'],
      'arrow-spacing': 'error',
      'no-confusing-arrow': [
        'error',
        {
          allowParens: true,
        },
      ],
      'no-useless-computed-key': 'error',
      'prefer-destructuring': [
        'error',
        {
          array: false,
          object: true,
        },
        {
          enforceForRenamedProperties: false,
        },
      ],
      'prefer-numeric-literals': 'error',
      'rest-spread-spacing': ['error', 'never'],
      'symbol-description': 'error',
      'template-curly-spacing': 'error',
      'yield-star-spacing': ['error', 'after'],
    },
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.git/**',
      'coverage/**',
      '*.min.js',
      'vendor/**',
      '.playwright-mcp/**',
      'report/**',
      'jscpd-report.json/**',
    ],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'script',
    },
  },
  {
    files: ['data.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        module: 'readonly',
        ValidationUtils: 'readonly',
        BookingLogic: 'readonly',
        DateUtils: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^(DataManager|dataManager|ValidationUtils|BookingLogic)$',
        },
      ],
    },
  },
  {
    files: ['translations.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        module: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^translations$',
        },
      ],
    },
  },
  {
    files: ['js/shared/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        module: 'readonly',
        dataManager: 'readonly',
        CalendarUtils: 'readonly',
        BookingLogic: 'readonly',
        ValidationUtils: 'readonly',
        BaseCalendar: 'readonly',
        DateUtils: 'readonly',
        PriceCalculator: 'readonly',
        ChristmasUtils: 'readonly',
        IdGenerator: 'readonly',
        BookingUtils: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^(ValidationUtils|BookingLogic|BaseCalendar|EditBookingComponent)$',
        },
      ],
    },
  },
  {
    files: ['js/shared/validationUtils.js'],
    languageOptions: {
      globals: {
        ValidationUtils: 'off',
      },
    },
  },
  {
    files: ['js/shared/bookingLogic.js'],
    languageOptions: {
      globals: {
        BookingLogic: 'off',
      },
    },
  },
  {
    files: ['js/shared/BaseCalendar.js'],
    languageOptions: {
      globals: {
        BaseCalendar: 'off',
      },
    },
  },
  {
    files: ['js/shared/dateUtils.js'],
    languageOptions: {
      globals: {
        DateUtils: 'off',
      },
    },
  },
  {
    files: ['js/shared/bookingUtils.js'],
    languageOptions: {
      globals: {
        BookingUtils: 'off',
      },
    },
  },
  {
    files: ['js/shared/idGenerator.js'],
    languageOptions: {
      globals: {
        IdGenerator: 'off',
      },
    },
  },
  {
    files: ['js/shared/christmasUtils.js'],
    languageOptions: {
      globals: {
        ChristmasUtils: 'off',
      },
    },
  },
  {
    files: ['js/shared/priceCalculator.js'],
    languageOptions: {
      globals: {
        PriceCalculator: 'off',
      },
    },
  },
  {
    files: ['js/**/*.js', 'admin.js'],
    ignores: ['js/shared/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        console: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        Worker: 'readonly',
        self: 'readonly',
        WorkerGlobalScope: 'readonly',
        dataManager: 'readonly',
        translations: 'readonly',
        ValidationUtils: 'readonly',
        BookingLogic: 'readonly',
        DataManager: 'readonly',
        CalendarUtils: 'readonly',
        AirbnbCalendarModule: 'readonly',
        BaseCalendar: 'readonly',
        DateUtils: 'readonly',
        BookingApp: 'readonly',
        CalendarModule: 'readonly',
        SingleRoomBookingModule: 'readonly',
        BulkBookingModule: 'readonly',
        BookingFormModule: 'readonly',
        UtilsModule: 'readonly',
        PriceCalculator: 'readonly',
        ChristmasUtils: 'readonly',
        IdGenerator: 'readonly',
        BookingUtils: 'readonly',
        EditBookingComponent: 'readonly',
        BookingDisplayUtils: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern:
            '^(DataManager|BookingApp|adminPanel|BookingFormModule|BulkBookingModule|SingleRoomBookingModule|CalendarModule|CalendarUtils|UtilsModule|AirbnbCalendarModule|BaseCalendar|editPage)$',
        },
      ],
    },
  },
  {
    files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        test: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        testUtils: 'readonly',
        dataManager: 'readonly',
        BookingLogic: 'readonly',
        ValidationUtils: 'readonly',
      },
    },
    rules: {
      'max-lines-per-function': 'off', // Test suites can be very long
      'max-statements': 'off', // Test cases can have many assertions
    },
  },
  {
    files: ['js/shared/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        dataManager: 'readonly',
        CalendarUtils: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^(BookingLogic|ValidationUtils|BaseCalendar|DateUtils)$',
        },
      ],
    },
  },
  {
    files: ['server.js', 'database.js'],
    rules: {
      'func-style': 'off', // Allow both function declarations and expressions in Node.js modules
      'no-implicit-globals': 'off', // Not applicable to Node.js modules
    },
  },
  {
    files: ['js/booking-app.js'],
    languageOptions: {
      globals: {
        BookingApp: 'off',
      },
    },
  },
  {
    files: ['js/calendar.js'],
    languageOptions: {
      globals: {
        CalendarModule: 'off',
      },
    },
  },
  {
    files: ['js/calendar-utils.js'],
    languageOptions: {
      globals: {
        CalendarUtils: 'off',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^CalendarUtils$',
        },
      ],
    },
  },
  {
    files: ['js/single-room-booking.js'],
    languageOptions: {
      globals: {
        SingleRoomBookingModule: 'off',
      },
    },
  },
  {
    files: ['js/bulk-booking.js'],
    languageOptions: {
      globals: {
        BulkBookingModule: 'off',
      },
    },
  },
  {
    files: ['js/booking-form.js'],
    languageOptions: {
      globals: {
        BookingFormModule: 'off',
      },
    },
  },
  {
    files: ['js/utils.js'],
    languageOptions: {
      globals: {
        UtilsModule: 'off',
      },
    },
  },
];
