import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import cors from "cors";
import { initializePassport } from "./passport";
import { setCacheByEndpoint } from "./cacheHeaders";
import { performanceMonitor } from "./performanceMonitor";
import { storage } from "./storage";
import { nukeAllUserData } from "./clearAllUserData";
import { searchLocalLocations, validateUKPostcode, formatUKPostcode } from "./ukLocations";

// Import domain-specific route modules
import { registerAuthRoutes } from "./routes/auth";
import { registerProfileRoutes } from "./routes/profiles";
import { registerJobRoutes } from "./routes/jobs";
import { registerApplicationRoutes } from "./routes/applications";
import { registerMessagingRoutes } from "./routes/messaging";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerAdminRoutes } from "./routes/admin";
import { registerFileRoutes } from "./routes/files";
import { registerRatingsRoutes } from "./routes/ratings";
import { registerContactRoutes } from "./routes/contact";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add performance monitoring middleware
  app.use(performanceMonitor.middleware());

  // CORS configuration for cross-domain cookie handling
  app.use(cors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      // Allow requests from Replit frontend and development
      const allowedOrigins = [
        /\.replit\.dev$/,
        /\.replit\.app$/,
        'http://localhost:5173',
        'http://127.0.0.1:5173'
      ];
      
      // Allow no origin (for mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin matches allowed patterns
      const isAllowed = allowedOrigins.some(pattern => {
        if (typeof pattern === 'string') {
          return origin === pattern;
        }
        return pattern.test(origin);
      });
      
      callback(null, isAllowed);
    },
    credentials: true, // CRITICAL: Allow cookies to be sent cross-domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Set-Cookie']
  }));

  // Security headers - disable CSP in development for Vite compatibility
  if (process.env.NODE_ENV === 'production') {
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));
  } else {
    // Disable CSP entirely in development to allow Vite functionality
    app.use(helmet({
      contentSecurityPolicy: false,
    }));
  }

  // General rate limiting
  const generalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
  
  app.use('/api/', generalRateLimit);

  // REMOVED: Trust proxy was forcing secure cookies even when secure: false
  // app.set('trust proxy', 1);

  // Production-ready session configuration with PostgreSQL storage
  const PgSession = connectPgSimple(session);
  
  // Create session store configuration with error handling for deployment
  const sessionStoreConfig = process.env.NODE_ENV === 'production' ? {
    // Production: Use PostgreSQL for session storage (required for autoscaling)
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'user_sessions', // Custom table name
      createTableIfMissing: false, // Don't auto-create to prevent deployment hangs - table should be pre-created
      pruneSessionInterval: 24 * 60 * 60, // Clean up expired sessions daily (seconds)
      errorLog: (...args: any[]) => {
        console.error('Session store error:', ...args);
      }
    }),
  } : {
    // Development: Use MemoryStore for faster development
    // No store specified = MemoryStore (default)
  };

  app.use(session({
    ...sessionStoreConfig,
    secret: process.env.SESSION_SECRET || 'eventlink-dev-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'eventlink.sid', // Custom session name for security
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Enable secure cookies in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : false // Enable SameSite in production
    },
    rolling: true // Reset expiry on activity
  }));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());
  initializePassport();

  // Health check endpoints
  app.get("/health", (req, res) => {
    res.status(200).json({ 
      status: "healthy", 
      service: "EventLink",
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  app.get("/api/health", (req, res) => {
    const healthData = performanceMonitor.getHealthCheck();
    res.json(healthData);
  });

  // Email connector diagnostic endpoint (development only)
  if (process.env.NODE_ENV === 'development') {
    app.get("/api/debug/email-connector", async (req, res) => {
      try {
        const { sendVerificationEmail } = await import('./emailService');
        
        // Try to send a test email
        try {
          await sendVerificationEmail(
            "test@example.com",
            "test-token-123",
            req.protocol + '://' + req.get('host')
          );
          res.json({ 
            status: "success",
            message: "Test email would be sent (not actually sent to test@example.com)" 
          });
        } catch (error: any) {
          res.json({ 
            status: "error",
            error: error.message,
            stack: error.stack
          });
        }
      } catch (error: any) {
        res.status(500).json({ 
          status: "error",
          message: "Failed to test email connector",
          error: error.message 
        });
      }
    });
  }

  // API root endpoint health check  
  app.get("/api", (req, res) => {
    res.status(200).send("EventLink API is running");
  });

  // Cache headers middleware
  app.use((req, res, next) => {
    setCacheByEndpoint(res, req.originalUrl);
    next();
  });

  // Register all domain-specific routes
  registerAuthRoutes(app);
  registerProfileRoutes(app);
  registerJobRoutes(app);
  registerApplicationRoutes(app);
  registerMessagingRoutes(app);
  registerNotificationRoutes(app);
  registerAdminRoutes(app);
  registerFileRoutes(app);
  registerRatingsRoutes(app);
  registerContactRoutes(app);

  // Main jobs endpoint - combines regular and external jobs with search/filtering
  app.get("/api/jobs", async (req, res) => {
    try {
      // Extract query parameters
      const keyword = (req.query.keyword as string) || '';
      const location = (req.query.location as string) || '';
      const startDate = (req.query.start_date as string) || '';
      const endDate = (req.query.end_date as string) || '';
      
      console.log('📋 Jobs endpoint called with filters:', { keyword, location, startDate, endDate });
      
      // Get filtered jobs from storage
      const jobs = await storage.searchJobs({ keyword, location, startDate, endDate });
      
      console.log(`📊 Found ${jobs.length} jobs after filtering`);
      
      res.json(jobs);
    } catch (error) {
      console.error("Get all jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Additional utility endpoints that don't fit into specific domains

  // External job sync endpoints
  app.post("/api/jobs/sync-external", async (req, res) => {
    try {
      console.log('🔄 External job sync requested');
      const { jobAggregator } = await import('./jobAggregator');
      const config = req.body.config; // Optional configuration
      
      // Check if sync is already in progress
      const isSync = jobAggregator.isSyncInProgress();
      if (isSync) {
        return res.json({ message: "Sync already in progress, skipping..." });
      }
      
      const result = await jobAggregator.syncExternalJobs(config);
      console.log('✅ External job sync completed');
      res.json({ 
        message: "External jobs synced successfully", 
        ...result 
      });
    } catch (error) {
      console.error("❌ Sync external jobs error:", error);
      res.status(500).json({ error: "Failed to sync external jobs" });
    }
  });

  // Get external jobs only (public endpoint - no authentication required)
  app.get("/api/jobs/external", async (req, res) => {
    try {
      console.log('📤 External jobs requested - returning', await storage.getExternalJobs().then(jobs => jobs.length), 'jobs');
      const externalJobs = await storage.getExternalJobs();
      res.json(externalJobs);
    } catch (error) {
      console.error("Get external jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Location search endpoint
  app.get("/api/locations/search", async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query parameter is required' });
      }
      
      if (query.length < 2) {
        return res.json([]);
      }
      
      const locations = searchLocalLocations(query);
      
      // Transform to expected UKLocation format
      const formattedLocations = locations.map(location => ({
        display_name: `${location.formatted}, United Kingdom`,
        name: location.name,
        county: location.county,
        postcode: "",
        city: location.name,
        town: location.type === 'town' ? location.name : undefined,
        village: location.type === 'village' ? location.name : undefined,
        formatted: location.formatted,
        lat: "51.5074", // Default coordinates - London area
        lon: "-0.1278"
      }));
      
      res.json(formattedLocations);
    } catch (error) {
      console.error('Location search error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Feedback submission endpoint (public)
  app.post("/api/feedback", async (req, res) => {
    try {
      const { feedbackType, message, pageUrl, timestamp, source } = req.body;

      if (!feedbackType || !message) {
        return res.status(400).json({ error: "Feedback type and message are required" });
      }

      // Validate feedback type - match frontend values
      const validTypes = ['malfunction', 'feature-missing', 'suggestion', 'other'];
      if (!validTypes.includes(feedbackType)) {
        return res.status(400).json({ error: "Invalid feedback type" });
      }

      // Get user info if available (optional authentication)
      let userId = null;
      let userEmail = null;
      
      // Try to get user from JWT if available (non-blocking)
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.startsWith('Bearer ') 
          ? authHeader.substring(7) 
          : null;
          
        if (token) {
          const jwt = require('jsonwebtoken');
          const JWT_SECRET = process.env.JWT_SECRET || 'eventlink-jwt-secret-change-in-production';
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded && typeof decoded === 'object') {
            const user = await storage.getUser((decoded as any).id);
            if (user) {
              userId = user.id;
              userEmail = user.email;
            }
          }
        }
      } catch (error) {
        // Non-blocking - feedback can be submitted anonymously
        console.log('Optional user lookup failed for feedback submission');
      }

      const feedback = await storage.createFeedback({
        user_id: userId,
        feedback_type: feedbackType,
        message,
        page_url: pageUrl,
        source: source || 'header',
        user_email: userEmail,
        status: 'pending'
      });

      res.status(201).json({ 
        message: "Feedback submitted successfully. Thank you for your input!",
        feedback: {
          id: feedback.id,
          feedback_type: feedback.feedback_type,
          status: feedback.status
        }
      });
    } catch (error) {
      console.error("Submit feedback error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Nuclear cleanup endpoint (development only)
  if (process.env.NODE_ENV === 'development') {
    app.post("/api/nuclear-cleanup", async (req, res) => {
      try {
        const { confirmation } = req.body;
        
        if (confirmation !== "DELETE_ALL_DATA_PERMANENTLY") {
          return res.status(400).json({ 
            error: "Invalid confirmation. This action requires explicit confirmation." 
          });
        }

        // This is a destructive operation that deletes ALL data
        await nukeAllUserData();
        
        res.json({ 
          message: "All data has been permanently deleted. Database reset complete.",
          warning: "This action cannot be undone."
        });
      } catch (error) {
        console.error("Nuclear cleanup error:", error);
        res.status(500).json({ error: "Failed to perform cleanup operation" });
      }
    });

    // Cache clearing endpoint (development only)
    app.post("/api/clear-cache", async (req, res) => {
      try {
        console.log('🧹 Clearing all server-side cache...');
        
        // Clear server-side cache (from storage.ts SimpleCache)
        storage.clearCache();
        
        res.json({ 
          message: "Server-side cache cleared successfully.",
          clientInstructions: {
            reactQuery: "Call queryClient.clear() to clear React Query cache",
            localStorage: "Call localStorage.clear() and sessionStorage.clear()",
            reload: "Consider window.location.reload() for complete refresh"
          }
        });
      } catch (error) {
        console.error("Cache clear error:", error);
        res.status(500).json({ error: "Failed to clear cache" });
      }
    });
  }

  // WebSocket server for real-time messaging
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws' // Use specific path to avoid Vite HMR conflicts
  });

  // Track active connections by user ID
  const activeConnections = new Map<number, WebSocket>();

  // Helper function to broadcast notification to a specific user
  const broadcastToUser = (userId: number, notificationData: any) => {
    const userWs = activeConnections.get(userId);
    if (userWs && userWs.readyState === WebSocket.OPEN) {
      userWs.send(JSON.stringify(notificationData));
    }
  };

  // Initialize WebSocket service with broadcast function
  const { wsService } = await import('./websocketService.js');
  wsService.initialize(broadcastToUser);

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('WebSocket connection established on /ws');
    
    let userId: number | null = null;

    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'authenticate') {
          userId = data.userId;
          if (userId) {
            activeConnections.set(userId, ws);
            console.log(`User ${userId} connected via WebSocket`);
          }
        } else if (data.type === 'message' && userId) {
          // Handle real-time message sending
          const { recipientId, content } = data;
          
          // Find or create conversation between users
          const conversation = await storage.getOrCreateConversation(userId, recipientId);
          
          // Save message to database
          const newMessage = await storage.sendMessage({
            conversation_id: conversation.id,
            sender_id: userId,
            content,
            is_read: false,
            is_system_message: false
          });

          // Send to recipient if they're connected
          const recipientWs = activeConnections.get(recipientId);
          if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
            // Get sender information for the popup
            const sender = await storage.getUser(userId);
            
            recipientWs.send(JSON.stringify({
              type: 'new_message',
              message: newMessage,
              sender: sender
            }));

            // Send updated badge counts to recipient
            try {
              const recipientCounts = await storage.getCategoryUnreadCounts(recipientId);
              recipientWs.send(JSON.stringify({
                type: 'badge_counts_update',
                counts: recipientCounts
              }));
            } catch (error) {
              console.error('Error getting recipient badge counts:', error);
            }
          }

          // Confirm to sender
          ws.send(JSON.stringify({
            type: 'message_sent',
            message: newMessage
          }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Failed to process message'
        }));
      }
    });

    ws.on('close', () => {
      if (userId) {
        activeConnections.delete(userId);
        console.log(`User ${userId} disconnected from WebSocket`);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (userId) {
        activeConnections.delete(userId);
      }
    });
  });

  return httpServer;
}