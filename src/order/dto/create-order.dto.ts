import { ApiProperty } from "@nestjs/swagger";
import { OrderStatus, OrderType } from "@prisma/client";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class CreateOrderDto {
    @ApiProperty({ name: "customer", type: "string" })
    @IsString()
    @IsOptional()
    customer: string;

    @ApiProperty({ name: "table", type: "string" })
    @IsString()
    @IsNotEmpty()
    table: string;

    @ApiProperty({ name: "itemId", type: "string" })
    @IsString()
    @IsNotEmpty()
    itemId: string;

    @ApiProperty({ name: "qty", type: "number" })
    @IsNumber()
    @IsNotEmpty()
    qty: number;

    @ApiProperty({ enum: ["BAR", "KITCHEN"] })
    @IsEnum(OrderType, { message: "Order type must either be from Bar or Kitchen" })
    @IsNotEmpty()
    orderType: OrderType;

    @ApiProperty({ enum: ["PENDING", "SERVCED", "CANCELLED", "PREPARING"] })
    @IsEnum(OrderStatus, { message: "Check order status" })
    @IsOptional()
    status: OrderStatus;
}

export class TopupStock {
    @ApiProperty({name:"itemId"})
    @IsString()
    @IsNotEmpty()
    itemId:string;

    @ApiProperty({name:"qty", type:"number"})
    @IsNumber()
    @IsNotEmpty()
    qty:number;
}
