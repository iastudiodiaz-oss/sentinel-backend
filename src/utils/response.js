/**
 * FORMATEADOR ESTANDARIZADO DE RESPUESTAS HTTP (REST API)
 */
const successResponse = (res, data = null, message = 'Operación exitosa', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

const errorResponse = (res, message = 'Error en el servidor', statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  successResponse,
  errorResponse
};
