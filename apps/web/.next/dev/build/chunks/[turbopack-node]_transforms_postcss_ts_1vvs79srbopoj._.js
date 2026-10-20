module.exports = [
"[turbopack-node]/transforms/postcss.ts?config=[project]/apps/web/postcss.config.js { CONFIG => \"[project]/apps/web/postcss.config.js_.loader.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "chunks/0rrk_0_0jmh_7zbsoa._.js",
  "chunks/[root-of-the-server]__1jlzd-wrt-557._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[turbopack-node]/transforms/postcss.ts?config=[project]/apps/web/postcss.config.js { CONFIG => \"[project]/apps/web/postcss.config.js_.loader.mjs [postcss] (ecmascript)\" } [postcss] (ecmascript)");
    });
});
}),
];