import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const agent = await prisma.agent.findUnique({
          where: { email: credentials.email },
          include: { service: true },
        });

        if (!agent || !agent.isActive) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          agent.passwordHash
        );

        if (!isValid) {
          return null;
        }

        return {
          id: agent.id,
          name: `${agent.firstName} ${agent.lastName}`,
          email: agent.email,
          role: agent.role,
          serviceId: agent.serviceId,
          serviceName: agent.service?.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.serviceId = (user as any).serviceId;
        token.serviceName = (user as any).serviceName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).serviceId = token.serviceId;
        (session.user as any).serviceName = token.serviceName;
      }
      return session;
    },
  },
  pages: {
    signIn: '/agent/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};
