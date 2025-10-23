import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { defineSecret } from 'firebase-functions/params';

// Define los secrets para el email
const emailUser = defineSecret("EMAIL_USER");
const emailPassword = defineSecret("EMAIL_PASSWORD");
const emailFrom = defineSecret("EMAIL_FROM");
const emailHost = defineSecret("EMAIL_HOST");
const emailPort = defineSecret("EMAIL_PORT");

/**
 * Interface para los datos del email
 */
export interface EmailData {
  to: string;
  subject: string;
  templateName: string;
  templateData: Record<string, any>;
}

/**
 * Interface para la configuración del transporter
 */
interface TransporterConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

/**
 * Crea y configura el transporter de nodemailer
 */
function createTransporter(): nodemailer.Transporter {
  const config: TransporterConfig = {
    host: emailHost.value(),
    port: parseInt(emailPort.value(), 10),
    secure: parseInt(emailPort.value(), 10) === 465, // true para 465, false para otros puertos
    auth: {
      user: emailUser.value(),
      pass: emailPassword.value()
    }
  };

  return nodemailer.createTransport(config);
}

/**
 * Lee y parsea una plantilla de email HTML
 * @param templateName - Nombre del archivo de plantilla (sin extensión)
 * @returns Contenido HTML de la plantilla
 */
function loadEmailTemplate(templateName: string): string {
  try {
    const candidatePaths = [
      path.join(__dirname, '..', '..', 'email-templates', `${templateName}.html`),
      path.join(__dirname, '..', 'email-templates', `${templateName}.html`)
    ];

    const resolvedPath = candidatePaths.find((p) => fs.existsSync(p));

    if (!resolvedPath) {
      throw new Error(`Template not found: ${templateName}.html`);
    }

    return fs.readFileSync(resolvedPath, 'utf-8');
  } catch (error) {
    console.error(`[EmailService] Error loading template ${templateName}:`, error);
    throw error;
  }
}

/**
 * Reemplaza las variables en la plantilla con los datos proporcionados
 * @param template - Plantilla HTML con variables {{variable}}
 * @param data - Datos para reemplazar en la plantilla
 * @returns HTML con variables reemplazadas
 */
function parseTemplate(template: string, data: Record<string, any>): string {
  let parsedTemplate = template;

  // Agregar año actual si no está en los datos
  const templateData: Record<string, any> = {
    year: new Date().getFullYear().toString(),
    ...data
  };

  // Reemplazar todas las variables {{variable}} con sus valores
  Object.keys(templateData).forEach((key) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    const value = templateData[key] !== undefined && templateData[key] !== null 
      ? templateData[key].toString() 
      : '';
    parsedTemplate = parsedTemplate.replace(regex, value);
  });

  return parsedTemplate;
}

/**
 * Envía un email usando una plantilla
 * @param emailData - Datos del email a enviar
 * @returns Promise que se resuelve cuando el email se envía
 */
export async function sendTemplatedEmail(emailData: EmailData): Promise<void> {
  try {
    console.log(`[EmailService] Preparing to send email to ${emailData.to} using template ${emailData.templateName}`);

    // Cargar la plantilla
    const template = loadEmailTemplate(emailData.templateName);
    
    // Parsear la plantilla con los datos
    const htmlContent = parseTemplate(template, emailData.templateData);

    // Crear el transporter
    const transporter = createTransporter();

    // Configurar el email
    const mailOptions = {
      from: emailFrom.value(),
      to: emailData.to,
      subject: emailData.subject,
      html: htmlContent
    };

    // Enviar el email
    const info = await transporter.sendMail(mailOptions);

    console.log(`[EmailService] Email sent successfully to ${emailData.to}. Message ID: ${info.messageId}`);
  } catch (error) {
    console.error(`[EmailService] Error sending email to ${emailData.to}:`, error);
    throw error;
  }
}

/**
 * Envía un email de bienvenida a un nuevo usuario
 * @param userEmail - Email del usuario
 * @param userData - Datos del usuario para personalizar el email
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userData: {
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    registrationDate: string;
  }
): Promise<void> {
  const emailData: EmailData = {
    to: userEmail,
    subject: '¡Bienvenido a Verona! 🎉',
    templateName: 'welcome',
    templateData: {
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userEmail,
      phoneNumber: userData.phoneNumber || 'No proporcionado',
      registrationDate: userData.registrationDate,
      storeUrl: process.env.STORE_URL || 'https://veronadeco.com',
      supportUrl: process.env.SUPPORT_URL || 'https://veronadeco.com/soporte',
      privacyUrl: process.env.PRIVACY_URL || 'https://veronadeco.com/privacidad'
    }
  };

  await sendTemplatedEmail(emailData);
}

/**
 * Función de utilidad para enviar emails personalizados
 * Útil para agregar nuevos tipos de emails en el futuro
 */
export async function sendCustomEmail(
  to: string,
  subject: string,
  templateName: string,
  data: Record<string, any>
): Promise<void> {
  const emailData: EmailData = {
    to,
    subject,
    templateName,
    templateData: data
  };

  await sendTemplatedEmail(emailData);
}

// Exportar también los secrets para usar en las funciones que necesiten acceso
export { emailUser, emailPassword, emailFrom, emailHost, emailPort };
