import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service'; // Adjust path if necessary

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    private readonly logger = new Logger(GoogleStrategy.name);

    constructor(
        private configService: ConfigService,
    ) {
        super({
            clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
            clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
            callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
            scope: ['email', 'profile'],
        });
    }

    async validate(
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback,
    ): Promise<any> {
        const { name, emails, photos, id } = profile;

        if (!emails || emails.length === 0) {
            this.logger.error('Google profile did not return an email address.');
            return done(new Error('No email found in Google profile'), null);
        }

        const user = {
            googleId: id,
            email: emails[0].value.toLowerCase(),
            firstName: name?.givenName || emails[0].value.split('@')[0],
            lastName: name?.familyName || '.',
            accessToken,
        };

        this.logger.log(`Google profile validated for email: ${user.email}`);
        done(null, user);
    }
}
