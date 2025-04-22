import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Mail Testing')
@Controller('mail-test')
export class MailTestController {
    private readonly logger = new Logger(MailTestController.name);

    constructor(private readonly mailerService: MailerService) { }

    @Get()
    getHello(): string {
        return 'Mail test endpoint is working. Use POST to send a test email.';
    }

    @Post('send')
    @ApiOperation({ summary: 'Send a test email (Development only)' })
    async sendTestEmail(@Body() body: { email: string }) {
        try {
            this.logger.log(`Attempting to send test email to ${body.email}...`);

            const result = await this.mailerService.sendMail({
                to: body.email,
                subject: 'Nomadly Test Email',
                text: 'This is a test email from Nomadly backend.',
                html: `
          <div style="background-color: #1E1E1E; color: #E0E0E0; padding: 20px; border-radius: 8px;">
            <h1 style="color: #FFFFFF;">Nomadly Test Email</h1>
            <p>This is a test email from Nomadly backend.</p>
            <p>If you can read this, the email configuration is working correctly.</p>
            <p style="color: #4CD964;">Sent at: ${new Date().toISOString()}</p>
          </div>
        `,
            });

            this.logger.log(`Test email sent successfully to ${body.email}`);
            this.logger.log(`Mail response: ${JSON.stringify(result)}`);

            return {
                success: true,
                message: 'Test email sent successfully',
                details: result
            };
        } catch (error) {
            this.logger.error(`Error sending test email: ${error.message}`);
            this.logger.error(error.stack);

            return {
                success: false,
                message: 'Failed to send test email',
                error: error.message
            };
        }
    }
}