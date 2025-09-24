import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
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

  // Enhanced session configuration for OAuth with security
  app.use(session({
    secret: process.env.SESSION_SECRET || 'eventlink-dev-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'eventlink.sid', // Custom session name for security
    cookie: {
      secure: false, // EXPLICIT: Never use secure cookies
      httpOnly: true, // Prevent XSS attacks
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: false // EXPLICIT: Disable SameSite to prevent cookie blocking
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

  // Main jobs endpoint - combines regular and external jobs
  app.get("/api/jobs", async (req, res) => {
    try {
      console.log('📋 Main jobs endpoint called - fetching all jobs...');
      
      // Get both regular and external jobs
      const [regularJobs, externalJobs] = await Promise.all([
        storage.getAllJobs(),
        storage.getExternalJobs()
      ]);
      
      console.log(`📊 Found ${regularJobs.length} regular jobs and ${externalJobs.length} external jobs`);
      
      // Combine and return all jobs
      const allJobs = [...regularJobs, ...externalJobs];
      res.json(allJobs);
    } catch (error) {
      console.error("Get all jobs error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Additional utility endpoints that don't fit into specific domains

  // External job sync endpoints
  app.post("/api/jobs/sync-external", async (req, res) => {
    try {
      const { jobAggregator } = await import('./jobAggregator');
      const config = req.body.config; // Optional configuration
      await jobAggregator.syncExternalJobs(config);
      res.json({ message: "External jobs synced successfully" });
    } catch (error) {
      console.error("Sync external jobs error:", error);
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
      const { type, message, email, rating } = req.body;

      if (!type || !message) {
        return res.status(400).json({ error: "Type and message are required" });
      }

      // Validate type
      const validTypes = ['bug', 'feature', 'improvement', 'other'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: "Invalid feedback type" });
      }

      // Validate rating if provided
      if (rating !== undefined && (rating < 1 || rating > 5)) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }

      const feedback = await storage.createFeedback({
        user_id: req.user?.id || null,
        feedback_type: type,
        message,
        user_email: email || req.user?.email || null,
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
  }

  // WebSocket server for real-time messaging
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws' // Use specific path to avoid Vite HMR conflicts
  });

  // Track active connections by user ID
  const activeConnections = new Map<number, WebSocket>();

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
            is_read: false
          });

          // Send to recipient if they're connected
          const recipientWs = activeConnections.get(recipientId);
          if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
            recipientWs.send(JSON.stringify({
              type: 'new_message',
              message: newMessage
            }));
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