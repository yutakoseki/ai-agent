/**
 * Amplify(Web Compute) のバンドラが Next.js の内部ランタイム依存
 * `next/dist/compiled/next-server/app-route.runtime.prod.js`
 * を成果物に含めない場合があり、App Router の Route Handler(/app/api/**) が
 * 実行時に `MODULE_NOT_FOUND` で落ちて HTML 500 を返すことがある。
 *
 * ここで明示的に import して file tracing に乗せ、成果物へ確実に含める。
 */
import "next/dist/compiled/next-server/app-route.runtime.prod.js";


