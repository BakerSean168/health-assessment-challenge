import type { ApiErrorCode } from "./api-error";
import type { ErrorCode } from "./error-code";

type Exact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;

const apiErrorCodesMatchTheSharedVocabulary: Exact<ErrorCode, ApiErrorCode> = true;
void apiErrorCodesMatchTheSharedVocabulary;
