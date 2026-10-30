import nodemailer from "nodemailer";

export type AuthEmail = {
  recipient: string;
  subject: string;
  text: string;
};

export type AuthEmailSender = (message: AuthEmail) => Promise<void>;

export function createSmtpEmailSender(input: {
  host: string;
  port: number;
  from: string;
}): AuthEmailSender {
  const transport = nodemailer.createTransport({
    host: input.host,
    port: input.port,
    secure: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  return async (message) => {
    await transport.sendMail({
      from: input.from,
      to: message.recipient,
      subject: message.subject,
      text: message.text,
    });
  };
}
