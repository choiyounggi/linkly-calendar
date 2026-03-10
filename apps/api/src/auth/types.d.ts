declare module 'passport-kakao' {
  import type { Strategy as PassportStrategy } from 'passport';

  export interface KakaoStrategyOptions {
    clientID: string;
    clientSecret?: string;
    callbackURL: string;
  }

  export class Strategy extends PassportStrategy {
    constructor(options: KakaoStrategyOptions, verify: (...args: any[]) => void);
  }
}

declare module 'passport-naver-v2' {
  import type { Strategy as PassportStrategy } from 'passport';

  export interface NaverStrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  }

  export class Strategy extends PassportStrategy {
    constructor(options: NaverStrategyOptions, verify: (...args: any[]) => void);
  }
}
