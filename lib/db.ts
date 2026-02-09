import { MongoClient, Db } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error("Please add your Mongo URI to .env.local");
}

const uri = process.env.MONGODB_URI;
const options = {
  serverSelectionTimeoutMS: 30000, // 30 seconds timeout (increased for slow networks)
  socketTimeoutMS: 45000, // 45 seconds socket timeout
  connectTimeoutMS: 30000, // 30 seconds connection timeout
  maxPoolSize: 10,
  minPoolSize: 1,
  retryWrites: true,
  retryReads: true,
  // Add these for better connection handling
  directConnection: false, // Let MongoDB driver handle connection routing
  heartbeatFrequencyMS: 10000, // Check server status every 10 seconds
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
    _mongoClient?: MongoClient;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClient = client;
    globalWithMongo._mongoClientPromise = client.connect().catch((error) => {
      console.error("MongoDB connection error:", error);
      // Reset the promise so it can be retried
      globalWithMongo._mongoClientPromise = undefined;
      throw error;
    });
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect().catch((error) => {
    console.error("MongoDB connection error:", error);
    throw error;
  });
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db("chat-app");
}
