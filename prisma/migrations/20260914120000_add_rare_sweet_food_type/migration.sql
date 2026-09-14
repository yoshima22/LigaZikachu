-- Doce Raro: novo valor do enum FoodType.
-- Aditivo e retrocompativel: nenhuma linha existente muda e o codigo antigo
-- continua valido, porque FOOD e SWEET seguem existindo.
ALTER TYPE "FoodType" ADD VALUE IF NOT EXISTS 'RARE_SWEET';
