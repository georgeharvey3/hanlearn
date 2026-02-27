declare module 'opencc-js' {
  type Locale = 'cn' | 'tw' | 'hk' | 'jp' | 'tw-health' | 'tw-education';
  interface ConverterOptions {
    from: Locale;
    to: Locale;
  }
  export function Converter(options: ConverterOptions): (text: string) => string;
}
