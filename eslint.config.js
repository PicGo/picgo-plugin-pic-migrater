module.exports = (async () => {
  const { default: love } = await import('eslint-config-love')

  return [
    {
      ignores: ['test.js', 'dist/**']
    },
    {
      ...love,
      files: ['src/**/*.{ts,tsx,js,jsx}'],
      languageOptions: {
        ...love.languageOptions,
        parserOptions: {
          ...(love.languageOptions?.parserOptions ?? {}),
          ecmaVersion: 6,
          sourceType: 'module'
        }
      },
      rules: {
        ...love.rules,
        '@typescript-eslint/strict-boolean-expressions': 'off',
        '@typescript-eslint/restrict-template-expressions': 'off',
        '@typescript-eslint/no-unnecessary-type-conversion': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/no-unnecessary-condition': 'off',
        '@typescript-eslint/no-magic-numbers': 'off',
        '@typescript-eslint/consistent-indexed-object-style': 'off',
        '@typescript-eslint/consistent-type-imports': 'off',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/non-nullable-type-assertion-style': 'off',
        '@typescript-eslint/init-declarations': 'off',
        '@typescript-eslint/prefer-regexp-exec': 'off',
        'no-prototype-builtins': 'off',
        'no-throw-literal': 'error',
        'no-unused-expressions': 'error',
        'no-redeclare': 'error',
        'no-await-in-loop': 'off',
        'no-param-reassign': 'off',
        'no-console': 'off',
        'prefer-destructuring': 'off',
        '@typescript-eslint/no-unsafe-type-assertion': 'off',
        'no-negated-condition': 'off',
        'arrow-body-style': 'off',
        'promise/avoid-new': 'off',
        '@typescript-eslint/prefer-destructuring': 'off',
        '@typescript-eslint/class-methods-use-this': 'off',
        'eslint-comments/require-description': 'off',
        curly: 'error',
        eqeqeq: 'error'
      }
    }
  ]
})()
