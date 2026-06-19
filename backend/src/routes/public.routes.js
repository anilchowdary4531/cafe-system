import {
    getRestaurantMenu,
    placeCustomerOrder,
} from '../controllers/public.controller.js';


export default async function (app) {
    app.get('/r/:slug/menu', getRestaurantMenu);
    app.post('/r/:slug/order', placeCustomerOrder);
}