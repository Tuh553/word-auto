export type ParseErrorCode =
  | "NOT_ZIP"
  | "ENCRYPTED"
  | "LEGACY_DOC"
  | "CORRUPT"
  | "NOT_DOCX";

export class ParseError extends Error {
  readonly code: ParseErrorCode;

  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.name = "ParseError";
    this.code = code;
  }
}

export const isParseError = (error: unknown): error is ParseError =>
  error instanceof ParseError;
