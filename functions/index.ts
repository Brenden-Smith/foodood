import * as functions from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { firestore } from "firebase-admin";
import axios from "axios";
const yelp = require("yelp-fusion");

// Initialize Firebase Admin SDK
initializeApp();

// Initialize Yelp API
const client = yelp.client(process.env.YELP_API_KEY);

type Business = {
  id: string;
  alias: string;
  name: string;
  image_url: string;
  is_closed: boolean;
  url: string;
  review_count: string;
  categories: Array<{ alias: string; title: string }>;
  rating: string;
  coordinates: { latitude: string; longitude: string };
  transactions: Array<string>;
  price: string;
  location: {
    address1: string;
    address2: string;
    address3: string;
    city: string;
    zip_code: string;
    country: string;
    state: string;
    display_address: Array<string>;
    cross_streets: string;
  };
  phone: string;
  display_phone: string;
  distance?: string;
  hours?: Array<{
    open: Array<{
      is_overnight: boolean;
      start: string;
      end: string;
      day: number;
    }>;
    hour_type: string;
    is_open_now: boolean;
  }>;
  attributes?: Array<any>;
};

type RawPlate = {
  name: string;
  description: string;
  price: string;
  image_url: string;
};

type Plate = {
  id: string;
  businessId: string;
  name: string;
  description: string;
  price: string;
  image_url: string;
};

export const getRecommendations = functions.https.onCall(
  async (data, context) => {
    // Get parameters
    const { tags, radius, longitude, latitude } = data;

    // Get businesses from Yelp API
    const businesses: Business[] = await client
      .search({
        categories: tags,
        radius: radius,
        longitude: longitude,
        latitude: latitude,
        limit: 20,
      })
      .then((response: any) => response.jsonBody.businesses);

    // Get menu items from each business
    const items = await Promise.all(
      businesses.map(async (business) => {
        // Check if business is in Firestore
        const businessDoc = await firestore()
          .collection("businesses")
          .doc(business.id)
          .get();

        // If business is in Firestore and is not expired, get plates from Firestore
        if (
          businessDoc.exists &&
          Date.now() - businessDoc.data()?.timestamp.toDate().getTime() <=
            businessDoc.data()?.ttl
        ) {
          const plates: Plate[] = await firestore()
            .collection("plates")
            .where("businessId", "==", business.id)
            .get()
            .then((querySnapshot) =>
              querySnapshot.docs.map((doc) => {
                return {
                  id: doc.id,
                  businessId: doc.data().businessId,
                  name: doc.data().name,
                  description: doc.data().description,
                  price: doc.data().price,
                  image_url: doc.data().image_url,
                };
              })
            );

          return plates;
        } else {
          // If business is in Firestore but is expired, delete plates from Firestore
          if (businessDoc.exists) {
            await firestore()
              .collection("plates")
              .where("businessId", "==", business.id)
              .get()
              .then((querySnapshot) =>
                Promise.all(querySnapshot.docs.map((doc) => doc.ref.delete()))
              );
          }

          // Call scrapeMenu using gcloud CLI
          const plateData: RawPlate[] = await axios.get(
            "https://us-central1-foodood-cloud.cloudfunctions.net/scrapeMenu",
            {
              params: {
                url: business.url.replace("yelp.com/biz", "yelp.com/menu"),
              },
            }
          );

          // Add plates to Firestore
          const plates: Plate[] = await Promise.all(
            plateData.map((plate) =>
              firestore()
                .collection("plates")
                .add({
                  businessId: business.id,
                  name: plate.name,
                  description: plate.description,
                  price: plate.price,
                  image_url: plate.image_url,
                })
                .then((docRef) => {
                  return {
                    id: docRef.id,
                    businessId: business.id,
                    name: plate.name,
                    description: plate.description,
                    price: plate.price,
                    image_url: plate.image_url,
                  };
                })
            )
          );

          // Add business to Firestore
          await firestore().collection("businesses").doc(business.id).set({
            name: business.name,
            image_url: business.image_url,
            is_closed: business.is_closed,
            url: business.url,
            review_count: business.review_count,
            categories: business.categories,
            rating: business.rating,
            coordinates: business.coordinates,
            transactions: business.transactions,
            price: business.price,
            location: business.location,
            phone: business.phone,
            display_phone: business.display_phone,
            distance: business.distance,
            hours: business.hours,
            attributes: business.attributes,
            timestamp: Date.now(),
            ttl: 86400000,
          });

          return plates;
        }
      })
    );

    return items;
  }
);