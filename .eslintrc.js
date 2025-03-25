module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['react', '@typescript-eslint', 'react-hooks'],
  rules: {
    // 关闭未使用变量的警告
    '@typescript-eslint/no-unused-vars': 'off',
    'no-unused-vars': 'off',
    // 允许any类型
    '@typescript-eslint/no-explicit-any': 'off',
    // 允许空函数
    '@typescript-eslint/no-empty-function': 'off',
    // 不校验索引签名
    '@typescript-eslint/no-index-signature': 'off'
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
}; 