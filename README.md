# TSX to XML

Prueba de concepto para generar archivos TSX a partir de un WSDL. El archivo tsx generado se puede usar para generar el XML de la petición SOAP.

## Uso

### Generar los archivos TSX

```bash
npm run generate
```

El output será en el archivo `src/GetCustomerRequest.tsx`.

### Ejecutar el código generado

```bash
npm run output
```

El output será en la consola.