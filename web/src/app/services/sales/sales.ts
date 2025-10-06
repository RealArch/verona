import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateOrderRequest, CreateOrderResponse } from '../../interfaces/sales';

@Injectable({
  providedIn: 'root'
})
export class Sales {
  private http = inject(HttpClient);

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
}
