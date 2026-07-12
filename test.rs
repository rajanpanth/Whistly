use std::{collections::BTreeMap};

use uuid::Uuid;

pub struct OpenOrder {
    pub user_id: Uuid,
    pub qty: u32,
    pub filled_qty: u32,
    pub original_order_id: Uuid,
}

pub struct Bid {
    pub total_qty: u32,
    pub orders: Vec<OpenOrder>
}
pub struct Ask {
    pub total_qty: u32,
    pub orders: Vec<OpenOrder>
}

pub struct Orderbook {
    pub bids: BTreeMap<u32, Bid>,
    pub asks: BTreeMap<u32, Ask>,
    pub current_order_index: u32,
    pub symbol: String,
}

impl Orderbook {
    pub fn new(symbol: String) -> Self {
        Self {
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            current_order_index: 0,
            symbol
        }
    }
}

pub enum Side {
    Bid,
    Ask
}

#[derive(Debug)]
pub struct Match {
    pub taker: Uuid,
    pub maker: Uuid,
    pub price: u32,
    pub qty: u32
}

#[derive(Debug)]
pub struct OrderResponse {
    pub filled_qty: u32, // how much of the qty was filled immedietely
    pub on_book: u32, // how much of the qty was put on the book incase a limit order didnt fill completely
    pub left_qty: u32, // How much qty was left to be filled for a market order incase the book wasnt liquid
    pub matches: Vec<Match>
}

impl Orderbook {
    pub fn create_order(&mut self, side: Side, qty: u32, user_id: Uuid, original_order_id: Uuid, price: Option<u32>) -> OrderResponse {
        let mut remaining = qty;
        let mut filled_qty = 0u32;
        let mut matches: Vec<Match> = vec![];
        let mut prices_to_remove: Vec<u32> = vec![];

        match side {
            Side::Bid => {
                // Match against asks in ascending price order (lowest ask = best ask first)
                for (ask_price, ask_level) in self.asks.iter_mut() {
                    if remaining == 0 { break; }
                    // For limit orders, only match if ask price is within bid limit
                    if let Some(bid_limit) = price {
                        if *ask_price > bid_limit { break; }
                    }

                    let mut level_fill = 0u32;
                    for order in ask_level.orders.iter_mut() {
                        if remaining == 0 { break; }
                        let available = order.qty - order.filled_qty;
                        if available == 0 { continue; }
                        let fill = available.min(remaining);
                        order.filled_qty += fill;
                        level_fill += fill;
                        filled_qty += fill;
                        remaining -= fill;
                        matches.push(Match {
                            taker: user_id,
                            maker: order.user_id,
                            price: *ask_price,
                            qty: fill,
                        });
                    }
                    ask_level.total_qty -= level_fill;
                    if ask_level.total_qty == 0 {
                        prices_to_remove.push(*ask_price);
                    }
                }
                for p in &prices_to_remove {
                    self.asks.remove(p);
                }

                // Place remaining qty on the book (limit orders only)
                let on_book = if let Some(bid_limit) = price {
                    if remaining > 0 {
                        let level = self.bids.entry(bid_limit).or_insert(Bid { total_qty: 0, orders: vec![] });
                        level.total_qty += remaining;
                        level.orders.push(OpenOrder {
                            user_id,
                            qty: remaining,
                            filled_qty: 0,
                            original_order_id,
                        });
                    }
                    remaining
                } else {
                    0
                };

                OrderResponse {
                    filled_qty,
                    on_book,
                    left_qty: if price.is_none() { remaining } else { 0 },
                    matches,
                }
            }
            Side::Ask => {
                // Match against bids in descending price order (highest bid = best bid first)
                for (bid_price, bid_level) in self.bids.iter_mut().rev() {
                    if remaining == 0 { break; }
                    // For limit orders, only match if bid price meets ask limit
                    if let Some(ask_limit) = price {
                        if *bid_price < ask_limit { break; }
                    }

                    let mut level_fill = 0u32;
                    for order in bid_level.orders.iter_mut() {
                        if remaining == 0 { break; }
                        let available = order.qty - order.filled_qty;
                        if available == 0 { continue; }
                        let fill = available.min(remaining);
                        order.filled_qty += fill;
                        level_fill += fill;
                        filled_qty += fill;
                        remaining -= fill;
                        matches.push(Match {
                            taker: user_id,
                            maker: order.user_id,
                            price: *bid_price,
                            qty: fill,
                        });
                    }
                    bid_level.total_qty -= level_fill;
                    if bid_level.total_qty == 0 {
                        prices_to_remove.push(*bid_price);
                    }
                }
                for p in &prices_to_remove {
                    self.bids.remove(p);
                }

                // Place remaining qty on the book (limit orders only)
                let on_book = if let Some(ask_limit) = price {
                    if remaining > 0 {
                        let level = self.asks.entry(ask_limit).or_insert(Ask { total_qty: 0, orders: vec![] });
                        level.total_qty += remaining;
                        level.orders.push(OpenOrder {
                            user_id,
                            qty: remaining,
                            filled_qty: 0,
                            original_order_id,
                        });
                    }
                    remaining
                } else {
                    0
                };

                OrderResponse {
                    filled_qty,
                    on_book,
                    left_qty: if price.is_none() { remaining } else { 0 },
                    matches,
                }
            }
        }
    }
}
