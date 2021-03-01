import { Injectable } from '@angular/core';

// Utils
import { AngularFirestore } from '@angular/fire/firestore'
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/mergeMap';
import * as firebase from 'firebase/app'; 
import { first, map } from 'rxjs/operators';
import { combineLatest, of } from "rxjs";

import * as moment from 'moment';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {

  constructor (
    private afs: AngularFirestore
  ) { }

  // Carros
  get_carros () {
    return this.afs.collection ('Vehiculos').valueChanges ();
  }

  async update_vehiculo_position (nodo: string, id: string, vehiculo_id: string, latitude: number, longitude: number) {
    let batch = this.afs.firestore.batch ();

    batch.update (this.afs.collection ('Vehiculos').doc (vehiculo_id).ref, {
      latitude: latitude,
      longitude: longitude,
      fecha_ultimo_movimiento: firebase.firestore.FieldValue.serverTimestamp ()
    });

    // batch.set (this.afs.collection (nodo).doc (id).collection ('Ruta').ref.doc (this.createId ()), {
    //   latitude: latitude,
    //   longitude: longitude
    // });

    return await batch.commit ();
  }

  get_distancia (lat1: any, lon1: any, lat2: any, lon2: any, factor: number = 1) {
  	let earthRadius = 6378.0;

    let dLat = this.toRad ((lat2 - lat1));
    let dLon = this.toRad ((lon2 - lon1));

   	let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
        
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	  let d = earthRadius * c;

	  return d * factor;	
  }

  toRad (x: any) {
    return x * Math.PI / 180;
  }
  
  get_vehiculo_position (vehiculo_id: string) {
    return this.afs.collection ('Vehiculos').doc (vehiculo_id).valueChanges ();
  }

  add_carga_gasolina (data: any) {
    return this.afs.collection ('Vehiculos').doc (data.vehiculo_id).collection ('Carga_Combustible').doc (data.id).set (data);
  }

  get_preferencias () {
    return this.afs.collection ('Preferencias').doc ('Preferencias_Conductor').valueChanges ();
  }

  // COnductores
  almuerzo_disponible (id: string, fecha: string) {
    return this.afs.collection ('Usuarios').doc (id).collection ('Almuerzos').doc (fecha).valueChanges ();
  }

  get_conductor_by_id (id: string) {
    return this.afs.collection ('Usuarios').doc (id).valueChanges ();
  }

  createId () {
    return this.afs.createId ();
  }

  async isUsuarioValid (uid: string) {
    return await this.afs.collection ('Usuarios').doc (uid).valueChanges ().pipe (first ()).toPromise ();
  }

  get_cardex_por_fechaconductor (usuario_id: string, fecha: string) {
    return this.afs.collection ('Cardex', ref => ref.where ('fecha', '==', fecha).where ('conductor_id', '==', usuario_id)).valueChanges ();
  }

  get_picking_por_fechaconductor (usuario_id: string, fecha: string) {
    return this.afs.collection ('Cardex', ref => ref.where ('fecha', '==', fecha).where ('conductor_id', '==', usuario_id)).valueChanges ();
  }

  get_pedidos_por_conductor (usuario_id: string) {
    const collection = this.afs.collection ('Usuarios').doc (usuario_id).collection ('Pedidos');

    return collection.snapshotChanges ().pipe (map (refReferencias => {
      if (refReferencias.length > 0) {
        return refReferencias.map (refReferencia => {
          const data: any = refReferencia.payload.doc.data();
          if (data.tipo === 'Cardex') {
            return this.get_cardex (data.id).pipe (map (subcategorias => Object.assign ({}, {data, ...subcategorias})));
          } else {
            return this.get_picking (data.id).pipe (map (subcategorias => Object.assign ({}, {data, ...subcategorias})));
          }
        });
      }
    })).mergeMap (observables => {
      if (observables) {
        return combineLatest(observables);
      } else {
        return of([]);
      }
    });
  }

  get_cardex (id: string) {
    return this.afs.collection ('Cardex').doc (id).valueChanges ();
  }

  get_picking (id: string) {
    return this.afs.collection ('Picking').doc (id).valueChanges ();
  }

  get_cardex_by_id (nodo: string, id: string) {
    return this.afs.collection (nodo).doc (id).valueChanges ();
  }

  get_clientes_by_cardex (nodo: string, id: string) {
    return this.afs.collection (nodo).doc (id).collection ('informacion_clientes', ref => ref.orderBy ('orden')).valueChanges ();
  }

  get_productos_by_cardex (nodo: string, id: string) {
    return this.afs.collection (nodo).doc (id).collection ('Productos').snapshotChanges().map (changes => {
      return changes.map(a => {
        const data = a.payload.doc.data();
        let checked = false;
        const id = a.payload.doc.id;
        return { id, checked, ...data };
      });
    });
  }

  update_cardex_ruta (nodo: string, item: any, value: string) {
    item [value] = firebase.firestore.FieldValue.serverTimestamp ();

    if (value === 'hora_inicio_carga') {
      item.estado = 'cargando';
    } else if (value === 'hora_fin_carga') {
      item.estado = 'fin_de_carga';
    } else if (value === 'hora_inicio_ruta') {
      item.estado = 'en_ruta';
    }

    return this.afs.collection (nodo).doc (item.id).update (item);
  }

  update_cardex (nodo: string, data: any) {
    if (data.estado === 'fin_ruta' || data.estado === 'camino_almacen') {
      data.hora_fin_ruta = firebase.firestore.FieldValue.serverTimestamp ();
      data.ultimo_cliente_hora = firebase.firestore.FieldValue.serverTimestamp ();
      data.cliente_actual = null;
    }

    return this.afs.collection (nodo).doc (data.id).update (data);
  }

  async update_cliente_cardex_ruta (nodo: string, item: any, cliente: any, value: string, tipo_descarga: string = 'completo', url: string = '') {
    let batch = this.afs.firestore.batch ();
    if (item.cliente_actual !== null && item.cliente_actual !== undefined) {
      cliente [value] = firebase.firestore.FieldValue.serverTimestamp ();
    }

    if (value === 'hora_llegada') {
      if (item.cliente_actual !== null && item.cliente_actual !== undefined) {
        cliente.estado = 'llego';
      }

      item.estado = 'esperando_cliente';
    } else if (value === 'hora_inicio_descarga') {
      if (item.cliente_actual !== null && item.cliente_actual !== undefined) {
        cliente.estado = 'descargando';
      }

      item.estado = 'descargando';
    } else if (value === 'hora_fin_descarga') {
      if (item.cliente_actual !== null && item.cliente_actual !== undefined) {
        cliente.estado = 'finalizado';
        cliente.tipo_descarga = tipo_descarga;
      }
      
      item.estado = 'en_ruta';
    } else if (value === 'hora_llegada_almacen') {
      item [value] = firebase.firestore.FieldValue.serverTimestamp ();
      item.estado = 'fin_ruta';
    } else if (value === 'hora_fin_ruta') {
      item [value] = firebase.firestore.FieldValue.serverTimestamp ();
      item.estado = 'finalizado';
    } else if (value === 'hora_ausencia') {
      if (item.cliente_actual !== null && item.cliente_actual !== undefined) {
        cliente.estado = 'ausente';
        cliente.ausencia_imagen = url;
      }
    } else if (value === 'hora_rechazo_total') {
      if (item.cliente_actual !== null && item.cliente_actual !== undefined) {
        cliente.estado = 'pendiente_rechazo_total';
      }
    }

    if (item.cliente_actual !== null && item.cliente_actual !== undefined) {
      batch.update (
        this.afs.collection (nodo).doc (item.id).collection ('informacion_clientes').doc (item.cliente_actual.id).ref,
        cliente
      );
    }

    batch.update (
      this.afs.collection (nodo).doc (item.id).ref,
      item
    );

    return await batch.commit ();
  }

  finalizar_ruta_vehiculo (item: any) {
    return this.afs.collection ('Vehiculos').doc (item.vehiculo_id).collection ('Pedidos').doc (item.id).update ({
      finalizado: true
    });
  }

  get_confirmacion_pendiente_ausente_usuario (nodo: string, cardex_id: string, cliente_id: string) {
    return this.afs.collection (nodo).doc (cardex_id).collection ('informacion_clientes').doc (cliente_id).valueChanges ();
  }

  async update_cardex_cliente_productos (nodo: string, cardex_id: any, cliente_id: string, productos: any []) {
    let batch = this.afs.firestore.batch ();

    productos.forEach ((produto: any) => {
      let ref = this.afs.collection (nodo).doc (cardex_id).collection ('informacion_clientes').doc (cliente_id).collection ('Productos').doc (produto.id).ref;
      batch.update (
        ref,
        produto
      );
    });

    return await batch.commit ();
  }

  get_cliente_by_cardex (nodo: string, item: any, cliente_id: string) {
    return this.afs.collection (nodo).doc (item.id).collection ('informacion_clientes').doc (cliente_id).valueChanges ();
  }

  get_productos_by_cardex_cliente (nodo: string, cardex_id: string, cliente_id: string) {
    return this.afs.collection (nodo).doc (cardex_id).collection ('informacion_clientes').doc (cliente_id).collection ('Productos').valueChanges ();
  }

  // Eventos
  async add_cardex_event (nodo: string, item: any, evento: any) {
    let batch = this.afs.firestore.batch ();

    item.estado_pasado = item.estado;
    item.estado = evento.tipo;
    item.evento_actual = evento;

    batch.set (
      this.afs.collection (nodo).doc (item.id).collection ('Eventos').doc (evento.id).ref,
      evento
    );

    batch.update (
      this.afs.collection (nodo).doc (item.id).ref,
      item
    );

    return await batch.commit ();
  }

  async finalizar_evento_cardex (nodo: string, item: any, evento: any) {
    let batch = this.afs.firestore.batch ();

    item.estado = item.estado_pasado;
    item.estado_pasado = null;
    item.evento_actual = null;

    batch.update (
      this.afs.collection (nodo).doc (item.id).collection ('Eventos').doc (evento.id).ref,
      {
        hora_fin: moment().format('HH[:]mm')
      }
    );

    batch.update (
      this.afs.collection (nodo).doc (item.id).ref,
      item
    );

    if (evento.tipo === 'almuerzo') {
      batch.set (
        this.afs.collection ('Usuarios').doc (evento.conductor_id).collection ('Almuerzos').doc (moment ().format ('DD[-]MM[-]YYYY')).ref,
        {
          id: true
        }
      );
    }

    return await batch.commit ();
  }
}
