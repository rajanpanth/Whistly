import { createAdminRpcHandler } from "../_handler";
import { CreatePollInput, zodValidator } from "../_validation";

export const POST = createAdminRpcHandler(
    "create_poll_atomic",
    (wallet, body) => ({
        p_wallet: wallet,
        p_id: body.p_id,
        p_poll_id: body.p_poll_id,
        p_title: body.p_title,
        p_description: body.p_description,
        p_category: body.p_category,
        p_image_url: body.p_image_url,
        p_option_images: body.p_option_images,
        p_options: body.p_options,
        p_unit_price_cents: body.p_unit_price_cents,
        p_end_time: body.p_end_time,
        p_creator_investment_cents: body.p_creator_investment_cents,
        p_market_kind: body.p_market_kind ?? 0,
    }),
    zodValidator(CreatePollInput)
);
