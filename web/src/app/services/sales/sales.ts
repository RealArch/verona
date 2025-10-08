import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Firestore, collection, query, where, orderBy, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { environment } from '../../../environments/environment';
import { CreateOrderRequest, CreateOrderResponse, Order } from '../../interfaces/sales';

@Injectable({
  providedIn: 'root'
})
export class Sales {
  private http = inject(HttpClient);
  private firestore = inject(Firestore);

  /**
   * Crea una nueva orden en el backend
   */
  async createOrder(orderData: CreateOrderRequest): Promise<CreateOrderResponse> {
    try {
      const response = await firstValueFrom(
        this.http.post<CreateOrderResponse>(`${environment.api}/orders/createOrder`, orderData)
      );
      return response;
    } catch (error: any) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  /**
   * Suscribirse a los pedidos de un usuario en tiempo real
   * @param userId ID del usuario
   * @param onData Callback cuando se reciben datos
   * @param onError Callback cuando hay un error
   * @returns Función para cancelar la suscripción
   */
  subscribeToUserOrders(
    userId: string,
    onData: (orders: Order[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    try {
      const ordersRef = collection(this.firestore, 'orders');
      const q = query(
        ordersRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      return onSnapshot(q, 
        (snapshot) => {
          const ordersData: Order[] = [];
          
          snapshot.forEach((doc) => {
            const data = doc.data();
            ordersData.push({
              id: doc.id,
              userId: data['userId'],
              items: data['items'] || [],
              shippingAddress: data['shippingAddress'] || null,
              billingAddress: data['billingAddress'],
              deliveryMethod: data['deliveryMethod'],
              paymentMethod: data['paymentMethod'],
              status: data['status'],
              notes: data['notes'],
              totals: data['totals'],
              createdAt: data['createdAt']?.toDate() || new Date(),
              updatedAt: data['updatedAt']?.toDate() || new Date()
            });
          });

          onData(ordersData);
        },
        (err) => {
          console.error('Error in orders subscription:', err);
          onError(new Error('Error al cargar los pedidos'));
        }
      );
    } catch (err) {
      console.error('Error setting up orders subscription:', err);
      throw new Error('Error al configurar la carga de pedidos');
    }
  }
}
