declare module 'segmentit' {
  interface SegmentOptions {
    simple?: boolean;
    stripPunctuation?: boolean;
  }

  interface SegmentResult {
    w: string;
    p: number;
  }

  class Segment {
    doSegment(text: string, options?: SegmentOptions): string[] | SegmentResult[];
  }

  function useDefault(segment: Segment): void;

  export { Segment, useDefault };
}
